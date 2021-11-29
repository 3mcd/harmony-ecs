import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

export function traverseLeft(
  archetype: Archetype.Struct,
  iteratee: (archetype: Archetype.Struct) => unknown,
  visited = new Set<Archetype.Struct>(),
) {
  const stack: (Archetype.Struct | number)[] = [0, archetype]
  let i = stack.length
  while (i > 0) {
    const node = stack[--i] as Archetype.Struct
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

export function traverse(
  archetype: Archetype.Struct,
  iteratee: (archetype: Archetype.Struct) => unknown,
  visited = new Set<Archetype.Struct>(),
) {
  const stack: (Archetype.Struct | number)[] = [0, archetype]
  let i = stack.length
  while (i > 0) {
    const node = stack[--i] as Archetype.Struct
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

function emitTable(archetype: Archetype.Struct) {
  traverseLeft(archetype, t => Signal.dispatch(t.onTableInsert, archetype))
}

export function find(world: World.Struct, type: Type.Struct) {
  let left = world.rootArchetype
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

function makeEdge(left: Archetype.Struct, right: Archetype.Struct, id: Schema.Id) {
  left.edgesSet[id] = right
  right.edgesUnset[id] = left
}

function makeArchetypeEnsurePath(
  world: World.Struct,
  root: Archetype.Struct,
  type: Type.Struct,
  emit: Archetype.Struct[],
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
  world: World.Struct,
  right: Archetype.Struct,
  left: Archetype.Struct,
  emit: Archetype.Struct[],
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
      right = makeArchetypeEnsurePath(world, world.rootArchetype, type, emit)
    }
    makeEdge(node, right, id)
    node = right
  }
  return node
}

function hasPathTraverse(left: Archetype.Struct, ids: number[]) {
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

function hasPath(left: Archetype.Struct, right: Archetype.Struct) {
  const ids = Type.getIdsBetween(right.type, left.type)
  return hasPathTraverse(left, ids)
}

function connectArchetypeTraverse(
  world: World.Struct,
  visiting: Archetype.Struct,
  inserted: Archetype.Struct,
  emit: Archetype.Struct[],
  visited = new Set(emit),
) {
  visited.add(visiting)
  if (Type.isSupersetOf(visiting.type, inserted.type)) {
    ensurePath(world, visiting, inserted, emit)
    return
  }
  if (
    Type.isSupersetOf(inserted.type, visiting.type) &&
    visiting !== world.rootArchetype
  ) {
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
  world: World.Struct,
  inserted: Archetype.Struct,
  emit: Archetype.Struct[],
) {
  world.rootArchetype.edgesSet.forEach(function connectArchetypeFromBase(node) {
    connectArchetypeTraverse(world, node, inserted, emit)
  })
}

function insertArchetype(
  world: World.Struct,
  root: Archetype.Struct,
  type: Type.Struct,
  emit: Archetype.Struct[],
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

export function findOrMakeArchetype(world: World.Struct, type: Type.Struct) {
  let emit: Archetype.Struct[] = []
  const archetype = insertArchetype(world, world.rootArchetype, type, emit)
  for (let i = 0; i < emit.length; i++) {
    emitTable(emit[i]!)
  }
  return archetype
}
