import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Model from "./model"
import * as Type from "./type"

export type World = {
  rootTable: Archetype.Table
  entityHead: number
  entityIndex: (Archetype.Table | undefined)[]
  schemaIndex: Model.Schema[]
  size: number
}

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

export function registerSchema(world: World, id: Entity.Id, schema: Model.Schema) {
  world.schemaIndex[id] = schema
}

export function findSchemaById(world: World, id: Entity.Id) {
  const schema = world.schemaIndex[id]
  Debug.invariant(
    schema !== undefined,
    `Failed to locate schema: entity "${id}" is not a schema`,
  )
  return schema
}

export function getEntityTable(world: World, entity: Entity.Id) {
  const table = world.entityIndex[entity]
  Debug.invariant(
    table !== undefined,
    `Failed to locate table: entity "${entity}" does not have an archetype`,
  )
  return table
}

export function tryGetEntityTable(world: World, entity: Entity.Id) {
  const table = world.entityIndex[entity]
  return table
}

export function setEntityTable(world: World, entity: Entity.Id, table: Archetype.Table) {
  world.entityIndex[entity] = table
}

export function unsetEntityTable(world: World, entity: Entity.Id) {
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
