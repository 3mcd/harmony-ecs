import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Model from "./model"
import * as Type from "./type"

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
 * discarded, but moved to the root archetype.
 */
export type World = {
  rootTable: Archetype.Table
  entityHead: number
  entityIndex: (Archetype.Table | undefined)[]
  schemaIndex: Model.AnySchema[]
  size: number
}

/** @internal */
export function registerSchema(world: World, id: Entity.Id, schema: Model.AnySchema) {
  world.schemaIndex[id] = schema
}

/** @internal */
export function findSchemaById(world: World, id: Entity.Id) {
  const schema = world.schemaIndex[id]
  Debug.invariant(
    schema !== undefined,
    `Failed to locate schema: entity "${id}" is not a schema`,
  )
  return schema
}

/** @internal */
export function getEntityTable(world: World, entity: Entity.Id) {
  const table = world.entityIndex[entity]
  Debug.invariant(
    table !== undefined,
    `Failed to locate table: entity "${entity}" is not real`,
  )
  return table
}

/** @internal */
export function tryGetEntityTable(world: World, entity: Entity.Id) {
  const table = world.entityIndex[entity]
  return table
}

/** @internal */
export function setEntityTable(world: World, entity: Entity.Id, table: Archetype.Table) {
  world.entityIndex[entity] = table
}

/** @internal */
export function unsetEntityTable(world: World, entity: Entity.Id) {
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
export function make(size: number): World {
  const type: Type.Type = []
  return {
    rootTable: Archetype.makeInner(type, []),
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    size,
  }
}
