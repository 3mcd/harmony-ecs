import { Archetype, makeArchetype } from "./archetype"
import { SchemaId } from "./schema"
import {
  addToType,
  getIdsBetween,
  isSupersetOf,
  maybeSupersetOf,
  removeFromType,
  Type,
} from "./type"
import { World } from "./world"

function makeEdge(inner: Archetype, outer: Archetype, id: SchemaId) {
  inner.edgesSet[id] = outer
  outer.edgesUnset[id] = inner
}

function makeLink(world: World, outer: Archetype, inner: Archetype) {
  const ids = getIdsBetween(outer.type, inner.type)
  let next = outer
  for (let i = 0; i < ids.length; i++) {
    const type = removeFromType(next.type, ids[i])
    const link = findOrMakeArchetype(world, type)
    makeEdge(link, next, ids[i])
    next = link
  }
}

function linkArchetype(world: World, archetype: Archetype, inserting: Archetype) {
  if (isSupersetOf(archetype.type, inserting.type)) {
    makeLink(world, archetype, inserting)
  } else if (isSupersetOf(inserting.type, archetype.type)) {
    makeLink(world, inserting, archetype)
  }
  // recurse into paths leading to potential supersets
  if (maybeSupersetOf(archetype.type, inserting.type)) {
    archetype.edgesSet.forEach(right => linkArchetype(world, right, inserting))
  }
}

function insertArchetype(world: World, type: Type): Archetype {
  const archetype = makeArchetype(world, type)
  linkArchetype(world, world.archetypeRoot, archetype)
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
  return archetype
}

export function findArchetype(world: World, type: Type) {
  let archetype = world.archetypeRoot
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    archetype = archetype.edgesSet[id]
    if (archetype === undefined) {
      return null
    }
  }
  return archetype
}

export function findOrMakeArchetype(world: World, type: Type) {
  let archetype = world.archetypeRoot
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    archetype = archetype.edgesSet[id] ?? insertArchetype(world, type.slice(0, i + 1))
  }
  return archetype
}
