import { Archetype, makeArchetype, makeTypeHash, Type, typeContains } from "./archetype"
import { SchemaId } from "./schema"
import { World } from "./world"

function makeEdges(left: Archetype, right: Archetype, id: SchemaId) {
  left.edgesSet[id] = right
  right.edgesUnset[id] = left
}

function linkArchetype(left: Archetype, archetype: Archetype) {
  if (left.type.length > archetype.type.length - 1) {
    return
  }

  if (left.type.length < archetype.type.length - 1) {
    left.edgesSet.forEach(edge => linkArchetype(edge, archetype))
    return
  }

  if (left.type.length === 0 || typeContains(archetype.type, left.type)) {
    let i = 0
    let length = archetype.type.length
    for (; i < length && left.type[i] === archetype.type[i]; i++);
    makeEdges(left, archetype, archetype.type[i])
  }
}

function insertArchetype(world: World, type: Type): Archetype {
  const archetype = makeArchetype(world, type)
  linkArchetype(world.root, archetype)
  world.onArchetypeCreated.dispatch(archetype)
  world.archetypes.set(makeTypeHash(archetype.type), archetype)
  return archetype
}

export function findOrMakeArchetype(world: World, type: Type) {
  let archetype = world.root
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    archetype = archetype.edgesSet[id] ?? insertArchetype(world, type.slice(0, i + 1))
  }
  return archetype
}
