import { Archetype, makeArchetype } from "./archetype"
import { invariant } from "./debug"
import { SchemaId } from "./model"
import { addToType, getIdsBetween, isSupersetOf, Type } from "./type"
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
    let right = left.edgesSet[id]
    if (right === undefined) {
      right = makeArchetype(world, [...left.type, id])
      makeEdge(left, right, id)
      emit.push(right)
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

function makeArbitraryPath(
  world: World,
  sup: Archetype,
  sub: Archetype,
  emit: Archetype[],
) {
  const ids = getIdsBetween(sup.type, sub.type)
  let left = sub
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    invariant(id !== undefined)
    const type = addToType(left.type, id)
    let right = findArchetype(world, type)
    if (right === null) {
      right = makeArchetypeEnsurePath(world, world.archetypeRoot, type, emit)
    }
    makeEdge(left, right, id)
    left = right
  }
  return left
}

function traverseInsert(
  world: World,
  root: Archetype,
  node: Archetype,
  emit: Archetype[],
  visited = new Set<Archetype>([node]),
) {
  if (visited.has(root)) {
    return
  }
  visited.add(root)
  if (isSupersetOf(node.type, root.type) && root !== world.archetypeRoot) {
    makeArbitraryPath(world, node, root, emit)
  }
  if (isSupersetOf(root.type, node.type)) {
    makeArbitraryPath(world, root, node, emit)
  }
  root.edgesSet.forEach(right => traverseInsert(world, right, node, emit, visited))
}

// This algorithm has three parts:
// (1) Create the initial chain of archetypes. For example, inserting the
//     archetype (1,2,3) produces a chain (from the root) of
//     (1)–>(1,2)–>(1,2,3).
// (2) Recursively visit each archetype in the graph. If the visited node is a
//     superset of the inserted node (i.e. of greater length and contains each
//     schema id of the inserted node), we create a chain of archetypes between
//     them, and stop traversal.
// (3) Track and emit all added archetypes.
export function findOrMakeArchetype(world: World, type: Type) {
  let emit: Archetype[] = []
  // (1)
  const archetype = makeArchetypeEnsurePath(world, world.archetypeRoot, type, emit)
  // (2)
  for (let i = 0; i < emit.length; i++) {
    const node = emit[i]
    invariant(node !== undefined)
    traverseInsert(world, world.archetypeRoot, node, emit)
  }
  // (3)
  emit.forEach(emitArchetype)

  return archetype
}
