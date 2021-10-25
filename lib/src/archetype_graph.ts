import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Model from "./model"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

export function traverseLeft(
  table: Archetype.Table,
  iteratee: (table: Archetype.Table) => unknown,
  visited = new Set<Archetype.Table>(),
) {
  const stack: (Archetype.Table | number)[] = [0, table]
  let i = stack.length
  while (i > 0) {
    const node = stack[--i] as Archetype.Table
    const index = stack[--i] as number
    if (index < node.edgesUnset.length - 1) {
      stack[i++] = index + 1
      stack[i++] = node
    }
    const next = node.edgesUnset[index]
    if (next && !visited.has(next)) {
      visited.add(next)
      iteratee(next)
      stack[i++] = 0
      stack[i++] = next
    }
  }
}

export function traverseRight(
  table: Archetype.Table,
  iteratee: (table: Archetype.Table) => unknown,
  visited = new Set<Archetype.Table>(),
) {
  const stack: (Archetype.Table | number)[] = [0, table]
  let i = stack.length
  while (i > 0) {
    const node = stack[--i] as Archetype.Table
    const index = stack[--i] as number
    if (index < node.edgesSet.length - 1) {
      stack[i++] = index + 1
      stack[i++] = node
    }
    const next = node.edgesSet[index]
    if (next && !visited.has(next)) {
      visited.add(next)
      iteratee(next)
      stack[i++] = 0
      stack[i++] = next
    }
  }
}

function emitTable(archetype: Archetype.Table) {
  traverseLeft(archetype, a => Signal.dispatch(a.onTableInsert, archetype))
}

export function find(world: World.World, type: Type.Type) {
  let left = world.rootTable
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    const right = left.edgesSet[id]
    if (right === undefined) {
      return
    }
    left = right
  }
  return left
}

function makeEdge(left: Archetype.Table, right: Archetype.Table, id: Model.SchemaId) {
  left.edgesSet[id] = right
  right.edgesUnset[id] = left
}

function makeArchetypeEnsurePath(
  world: World.World,
  root: Archetype.Table,
  type: Type.Type,
  emit: Archetype.Table[],
) {
  let left = root
  for (let i = 0; i < type.length; i++) {
    const id = type[i]!
    let right = left.edgesSet[id]
    if (right === undefined) {
      const type = Type.add(left.type, id)
      right = find(world, type)
      if (right === undefined) {
        right = Archetype.make(world, type)
        emit.push(right)
      }
      makeEdge(left, right, id)
    }
    left = right
  }
  return left
}

function ensurePath(
  world: World.World,
  right: Archetype.Table,
  left: Archetype.Table,
  emit: Archetype.Table[],
) {
  if (hasPath(left, right)) return
  const ids = Type.getIdsBetween(right.type, left.type)
  let node = left
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    Debug.invariant(id !== undefined)
    const type = Type.add(node.type, id)
    let right = find(world, type)
    if (right === undefined) {
      right = makeArchetypeEnsurePath(world, world.rootTable, type, emit)
    }
    makeEdge(node, right, id)
    node = right
  }
  return node
}

function hasPathTraverse(left: Archetype.Table, ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    Debug.invariant(id !== undefined)
    const next = left.edgesSet[id]
    if (next !== undefined) {
      if (ids.length === 1) {
        return true
      }
      const nextIds = ids.slice()
      const swapId = nextIds.pop()
      if (i !== nextIds.length) {
        Debug.invariant(swapId !== undefined)
        nextIds[i] = swapId
      }
      if (hasPathTraverse(next, nextIds)) {
        return true
      }
    }
  }
  return false
}

function hasPath(left: Archetype.Table, right: Archetype.Table) {
  const ids = Type.getIdsBetween(right.type, left.type)
  return hasPathTraverse(left, ids)
}

function connectArchetypeTraverse(
  world: World.World,
  visiting: Archetype.Table,
  inserted: Archetype.Table,
  emit: Archetype.Table[],
  visited = new Set(emit),
) {
  visited.add(visiting)
  if (Type.isSupersetOf(visiting.type, inserted.type)) {
    ensurePath(world, visiting, inserted, emit)
    return
  }
  if (Type.isSupersetOf(inserted.type, visiting.type) && visiting !== world.rootTable) {
    ensurePath(world, inserted, visiting, emit)
  }
  visiting.edgesSet.forEach(function connectNextArchetype(next) {
    if (
      !visited.has(next) &&
      (Type.maybeSupersetOf(next.type, inserted.type) ||
        Type.maybeSupersetOf(inserted.type, next.type))
    ) {
      connectArchetypeTraverse(world, next, inserted, emit, visited)
    }
  })
}

function connectArchetype(
  world: World.World,
  inserted: Archetype.Table,
  emit: Archetype.Table[],
) {
  world.rootTable.edgesSet.forEach(function connectArchetypeFromBase(node) {
    connectArchetypeTraverse(world, node, inserted, emit)
  })
}

function insert(
  world: World.World,
  root: Archetype.Table,
  type: Type.Type,
  emit: Archetype.Table[],
) {
  let left = root
  for (let i = 0; i < type.length; i++) {
    const id = type[i]!
    let right = left.edgesSet[id]
    if (right === undefined) {
      const type = Type.add(left.type, id)
      right = find(world, type)
      let connect = false
      if (right === undefined) {
        right = Archetype.make(world, type)
        emit.push(right)
        connect = true
      }
      makeEdge(left, right, id)
      if (connect) {
        connectArchetype(world, right, emit)
      }
    }
    left = right
  }
  return left
}

export function findOrMake(world: World.World, type: Type.Type) {
  let emit: Archetype.Table[] = []
  const archetype = insert(world, world.rootTable, type, emit)
  for (let i = 0; i < emit.length; i++) {
    emitTable(emit[i]!)
  }
  return archetype
}
