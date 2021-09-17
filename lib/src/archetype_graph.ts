import { Archetype, makeArchetype } from "./archetype"
import { invariant } from "./debug"
import { SchemaId } from "./model"
import { addToType, getIdsBetween, isSupersetOf, maybeSupersetOf, Type } from "./type"
import { World } from "./world"

function makeEdge(left: Archetype, right: Archetype, id: SchemaId) {
  left.edgesSet[id] = right
  right.edgesUnset[id] = left
}

function emitArchetype(archetype: Archetype) {
  const visited = new Set<Archetype>()
  const stack: (Archetype | number)[] = [0, archetype]
  let i = stack.length
  while (i > 0) {
    const node = stack[--i] as Archetype
    const index = stack[--i] as number
    if (index < node.edgesUnset.length - 1) {
      stack[i++] = index + 1
      stack[i++] = node
    }
    const next = node.edgesUnset[index]
    if (next && !visited.has(next)) {
      visited.add(next)
      next.onArchetypeInsert.dispatch(archetype)
      stack[i++] = 0
      stack[i++] = next
    }
  }
}

function makeArchetypeEnsurePath(
  world: World,
  root: Archetype,
  type: Type,
  emit: Archetype[],
) {
  let left = root
  for (let i = 0; i < type.length; i++) {
    const id = type[i]!
    let right = left.edgesSet[id] ?? null
    if (right === null) {
      const type = addToType(left.type, id)
      right = findArchetype(world, type)
      if (right === null) {
        right = makeArchetype(world, type)
        emit.push(right)
      }
      makeEdge(left, right, id)
    }
    left = right
  }
  return left
}

export function findArchetype(world: World, type: Type) {
  let left = world.archetypeRoot
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    const right = left.edgesSet[id]
    if (right === undefined) {
      return null
    }
    left = right
  }
  return left
}

function ensurePath(world: World, right: Archetype, left: Archetype, emit: Archetype[]) {
  if (hasPath(left, right)) return
  const ids = getIdsBetween(right.type, left.type)
  let node = left
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    invariant(id !== undefined)
    const type = addToType(node.type, id)
    let right = findArchetype(world, type)
    if (right === null) {
      right = makeArchetypeEnsurePath(world, world.archetypeRoot, type, emit)
    }
    makeEdge(node, right, id)
    node = right
  }
  return node
}

function hasPathTraverse(left: Archetype, ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    invariant(id !== undefined)
    const next = left.edgesSet[id]
    if (next !== undefined) {
      if (ids.length === 1) {
        return true
      }
      const nextIds = ids.slice()
      const swapId = nextIds.pop()
      if (i !== nextIds.length) {
        invariant(swapId !== undefined)
        nextIds[i] = swapId
      }
      if (hasPathTraverse(next, nextIds)) {
        return true
      }
    }
  }
  return false
}

function hasPath(left: Archetype, right: Archetype) {
  const ids = getIdsBetween(right.type, left.type)
  return hasPathTraverse(left, ids)
}

function connectArchetype(
  world: World,
  visiting: Archetype,
  inserted: Archetype,
  emit: Archetype[],
  visited = new Set(emit),
) {
  if (visiting === world.archetypeRoot) {
    visiting.edgesSet.forEach(right => connectArchetype(world, right, inserted, emit))
    return
  }
  if (visited.has(visiting)) {
    return
  }
  visited.add(visiting)
  if (isSupersetOf(visiting.type, inserted.type)) {
    ensurePath(world, visiting, inserted, emit)
  }
  if (isSupersetOf(inserted.type, visiting.type) && visiting !== world.archetypeRoot) {
    ensurePath(world, inserted, visiting, emit)
  }
  visiting.edgesSet.forEach(function connectNextArchetype(next) {
    if (
      !(
        maybeSupersetOf(next.type, inserted.type) ||
        maybeSupersetOf(inserted.type, next.type)
      )
    ) {
      return
    }
    connectArchetype(world, next, inserted, emit)
  })
}

function insert(world: World, root: Archetype, type: Type, emit: Archetype[]) {
  let left = root
  for (let i = 0; i < type.length; i++) {
    const id = type[i]!
    let right = left.edgesSet[id] ?? null
    if (right === null) {
      const type = addToType(left.type, id)
      right = findArchetype(world, type)
      let connect = false
      if (right === null) {
        right = makeArchetype(world, type)
        emit.push(right)
        connect = true
      }
      makeEdge(left, right, id)
      if (connect) {
        connectArchetype(world, world.archetypeRoot, right, emit)
      }
    }
    left = right
  }
  return left
}

export function findOrMakeArchetype(world: World, type: Type) {
  let emit: Archetype[] = []
  const archetype = insert(world, world.archetypeRoot, type, emit)
  for (let i = 0; i < emit.length; i++) {
    emitArchetype(emit[i]!)
  }
  return archetype
}
