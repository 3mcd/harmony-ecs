import { Archetype, makeArchetype } from "./archetype"
import { invariant } from "./debug"
import { SchemaId } from "./model"
import { getIdsBetween, isSupersetOf, removeFromType, Type } from "./type"
import { World } from "./world"

function makeEdge(left: Archetype, right: Archetype, id: SchemaId) {
  left.edgesSet[id] = right
  right.edgesUnset[id] = left
}

function linkExisting(node: Archetype, next: Archetype, visited: Set<Archetype>) {
  if (visited.has(node)) return
  visited.add(node)
  if (isSupersetOf(next.type, node.type) && next.type.length - node.type.length === 1) {
    const id = getIdsBetween(next.type, node.type)[0]
    invariant(id !== undefined)
    makeEdge(node, next, id)
  }
  if (isSupersetOf(node.type, next.type) && node.type.length - next.type.length === 1) {
    const id = getIdsBetween(node.type, next.type)[0]
    invariant(id !== undefined)
    makeEdge(next, node, id)
  }

  node.edgesSet.forEach(edge => linkExisting(edge, next, visited))
}

function linkArchetype(
  world: World,
  node: Archetype,
  next: Archetype,
  emit: Archetype[],
  visited: Set<Archetype>,
) {
  if (visited.has(node)) return
  visited.add(node)

  if (isSupersetOf(node.type, next.type)) {
    const ids = getIdsBetween(node.type, next.type)
    let prev = node
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      invariant(id !== undefined)
      const type = removeFromType(prev.type, id)
      let node = findArchetype(world, type)
      if (node === null) {
        node = makeAndConnectArchetype(world, prev, type)
        emit.push(node)
      } else {
        makeEdge(node, prev, id)
      }
      prev = node
    }
    return
  }

  if (isSupersetOf(next.type, node.type) && node !== world.archetypeRoot) {
    // if (isSupersetOf(next.type, node.type) && next.type.length - node.type.length === 1) {
    const ids = getIdsBetween(next.type, node.type)
    let prev = next
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      invariant(id !== undefined)
      const type = removeFromType(prev.type, id)
      let node = findArchetype(world, type)
      if (node === null) {
        node = makeAndConnectArchetype(world, prev, type)
        emit.push(node)
      } else {
        makeEdge(node, prev, id)
      }
      prev = node
    }
  }

  node.edgesSet.forEach(edge => linkArchetype(world, edge, next, emit, visited))
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

export function findArchetype(world: World, type: Type) {
  let archetype = world.archetypeRoot
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    const next = archetype.edgesSet[id]
    if (next === undefined) {
      return null
    }
    archetype = next
  }
  return archetype
}

function makeAndConnectArchetype(world: World, node: Archetype, type: Type) {
  invariant(Math.abs(type.length - node.type.length) === 1)
  let l: Type
  let r: Type
  if (isSupersetOf(node.type, type)) {
    l = type
    r = node.type
  } else {
    l = node.type
    r = type
  }
  const id = getIdsBetween(r, l)[0]
  invariant(id !== undefined)
  const next = makeArchetype(world, type)
  makeEdge(node, next, id)
  return next
}

// This algorithm has three parts:
// (1) Create the initial chain of archetypes. For example, inserting the
//     archetype (1,2,3) produces a chain (from the root) of
//     (1)–>(1,2)–>(1,2,3).
// (2) Recursively visit each archetype in the graph. If the visited node is a
//     superset of the inserted node (i.e. of greater length and contains each
//     schema id of the inserted node), we create a chain of archetypes between
//     them, and stop traversal.
export function findOrMakeArchetype(world: World, type: Type) {
  const visited = new Set<Archetype>()
  let emit: Archetype[] = []
  let left = world.archetypeRoot
  // (1)
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    let right = left.edgesSet[id]
    if (right === undefined) {
      right = makeAndConnectArchetype(world, left, type.slice(0, i + 1))
      emit.push(right)
      visited.add(right)
    }
    left = right
  }

  // (2)
  linkArchetype(world, world.archetypeRoot, left, emit, visited)

  for (let i = 0; i < emit.length; i++) {
    linkArchetype(world, world.archetypeRoot, emit[i]!, [], new Set())
  }

  emit.forEach(emitArchetype)

  return left
}
