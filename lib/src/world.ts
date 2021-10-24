import {
  Archetype,
  ArchetypeRow,
  insertIntoArchetype,
  makeRootArchetype,
  moveEntity,
  removeFromArchetype,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import {
  ComponentSet,
  ComponentSetInit,
  expressType,
  makeComponentSet,
} from "./component"
import { invariant } from "./debug"
import { Entity } from "./entity"
import { Schema } from "./model"
import { and, normalizeType, Type, xor } from "./type"

export type World = {
  archetypeRoot: Archetype
  entityHead: number
  entityIndex: (Archetype | undefined)[]
  schemaIndex: Schema[]
  size: number
}

export function makeWorld(size: number): World {
  return {
    archetypeRoot: makeRootArchetype(),
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    size,
  }
}

export function registerSchema(world: World, id: Entity, schema: Schema) {
  world.schemaIndex[id] = schema
}

export function findSchemaById(world: World, id: Entity) {
  const schema = world.schemaIndex[id]
  invariant(schema !== undefined)
  return schema
}

export function getEntityLocation(world: World, entity: Entity) {
  const archetype = world.entityIndex[entity]
  invariant(archetype !== undefined)
  return archetype
}

export function tryGetEntityArchetype(world: World, entity: Entity) {
  const archetype = world.entityIndex[entity]
  return archetype
}

export function setEntityArchetype(world: World, entity: Entity, archetype: Archetype) {
  world.entityIndex[entity] = archetype
}

export function unsetEntityArchetype(world: World, entity: Entity) {
  world.entityIndex[entity] = undefined
}

export function reserveEntity(world: World, entity = world.entityHead) {
  while (
    !(world.entityIndex[entity] === undefined && world.schemaIndex[entity] === undefined)
  ) {
    entity = world.entityHead++
  }
  return entity
}

function insertEntity(
  world: World,
  entity: Entity,
  archetype: Archetype,
  data: ComponentSet,
) {
  insertIntoArchetype(archetype, entity, data)
  setEntityArchetype(world, entity, archetype)
}

export function deleteEntity(world: World, entity: Entity) {
  const archetype = world.entityIndex[entity]
  invariant(archetype !== undefined)
  removeFromArchetype(archetype, entity)
  unsetEntityArchetype(world, entity)
}

export function set<$Type extends Type>(
  world: World,
  entity: Entity,
  layout: $Type,
  init: ComponentSetInit<$Type> = [] as unknown as ComponentSetInit<$Type>,
) {
  const prev = tryGetEntityArchetype(world, entity)
  const data = makeComponentSet(world, layout, init)
  // Entity either doesn't exist, or was previously destroyed.
  if (prev === undefined) {
    // Insert the entity into an archetype defined by the provided layout.
    const type = normalizeType(layout)
    const next = findOrMakeArchetype(world, type)
    insertEntity(world, entity, next, data)
  } else {
    // Move the entity to an archetype that is the combination of the entity's
    // existing type and the provided layout.
    const type = and(prev.type, layout)
    const next = findOrMakeArchetype(world, type)
    moveEntity(entity, prev, next, data)
  }
}

export function unset<$Type extends Type>(world: World, entity: Entity, layout: $Type) {
  const prev = getEntityLocation(world, entity)
  const type = xor(prev.type, layout)
  const next = findOrMakeArchetype(world, type)
  moveEntity(entity, prev, next)
}

export function makeEntity<$Type extends Type>(
  world: World,
  layout: $Type = [] as unknown as $Type,
  init: ArchetypeRow<$Type> = expressType(world, layout),
) {
  const data = makeComponentSet(world, layout, init)
  const type = normalizeType(layout)
  const entity = reserveEntity(world)
  const archetype = findOrMakeArchetype(world, type)
  insertEntity(world, entity, archetype, data)
  return entity
}
