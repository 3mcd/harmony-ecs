import { Archetype, makeRootArchetype } from "./archetype"
import { invariant } from "./debug"
import { Entity } from "./entity"
import { Schema } from "./schema"

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

export function registerSchema(world: World, schemaId: Entity, schema: Schema) {
  world.schemaIndex[schemaId] = schema
}

export function findSchemaById(world: World, schemaId: Entity) {
  const schema = world.schemaIndex[schemaId]
  invariant(schema !== undefined)
  return schema
}

export function getEntityLocation(world: World, entity: Entity) {
  const archetype = world.entityIndex[entity]
  invariant(archetype !== undefined)
  return archetype
}

export function tryGetEntityLocation(world: World, entity: Entity) {
  const archetype = world.entityIndex[entity]
  return archetype
}

export function setEntityLocation(world: World, entity: Entity, archetype: Archetype) {
  world.entityIndex[entity] = archetype
}

export function unsetEntityLocation(world: World, entity: Entity) {
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
