import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Schema from "./schema"
import * as Type from "./type"

export class EntityNotRealError extends Error {
  constructor(entity: Entity.Id) {
    super(`Entity "${entity}" is not real`)
  }
}

/**
 * The root object of the ECS. A world maintains entity identifiers, stores
 * schemas, and associates components with entities in tables called
 * archetypes: collections of entities that share the same component makeup.
 *
 * Archetypes are stored in a connected graph structure, where each node is
 * linked to adjacent archetypes by the addition or removal or a single
 * component type. An entity's archetype is selected based on its current
 * component composition. An entity can belong only to a single archetype at a
 * time.
 *
 * Entities without any components (e.g. destroyed entities) are never
 * discarded, but moved to the world's root archetype.
 */
export type Struct = {
  rootTable: Archetype.Struct
  entityHead: number
  entityIndex: (Archetype.Struct | undefined)[]
  schemaIndex: Schema.AnySchema[]
  size: number
}

/** @internal */
export function registerSchema(world: Struct, id: Entity.Id, schema: Schema.AnySchema) {
  world.schemaIndex[id] = schema
}

/** @internal */
export function findSchemaById(world: Struct, id: Entity.Id) {
  const schema = world.schemaIndex[id]
  Debug.invariant(
    schema !== undefined,
    `Failed to locate schema: entity "${id}" is not a schema`,
  )
  return schema
}

/** @internal */
export function getEntityArchetype(world: Struct, entity: Entity.Id) {
  const archetype = world.entityIndex[entity]
  Debug.invariant(
    archetype !== undefined,
    `Failed to locate archetype`,
    new EntityNotRealError(entity),
  )
  return archetype
}

/** @internal */
export function tryGetEntityArchetype(world: Struct, entity: Entity.Id) {
  const archetype = world.entityIndex[entity]
  return archetype
}

/** @internal */
export function setEntityArchetype(
  world: Struct,
  entity: Entity.Id,
  archetype: Archetype.Struct,
) {
  world.entityIndex[entity] = archetype
}

/** @internal */
export function unsetEntityArchetype(world: Struct, entity: Entity.Id) {
  world.entityIndex[entity] = undefined
}

/**
 * Create a world. Requires a maximum entity size which is used to allocate
 * fixed memory for binary component arrays.
 *
 * @example <caption>Create a world capable of storing one million entities</caption>
 * ```ts
 * const world = World.make(1e6)
 * ```
 */
export function make(size: number): Struct {
  const type: Type.Struct = []
  return {
    rootTable: Archetype.makeInner(type, []),
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    size,
  }
}
