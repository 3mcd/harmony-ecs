import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Component from "./component"
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
  return {
    rootTable: Archetype.makeRoot(),
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    size,
  }
}

export function registerSchema(world: World, id: Entity.Entity, schema: Model.Schema) {
  world.schemaIndex[id] = schema
}

export function findSchemaById(world: World, id: Entity.Entity) {
  const schema = world.schemaIndex[id]
  Debug.invariant(schema !== undefined)
  return schema
}

export function getEntityTable(world: World, entity: Entity.Entity) {
  const table = world.entityIndex[entity]
  Debug.invariant(table !== undefined)
  return table
}

export function tryGetEntityTable(world: World, entity: Entity.Entity) {
  const table = world.entityIndex[entity]
  return table
}

export function setEntityTable(
  world: World,
  entity: Entity.Entity,
  table: Archetype.Table,
) {
  world.entityIndex[entity] = table
}

export function unsetEntityArchetype(world: World, entity: Entity.Entity) {
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

export function deleteEntity(world: World, entity: Entity.Entity) {
  const table = world.entityIndex[entity]
  Debug.invariant(table !== undefined)
  Archetype.remove(table, entity)
  unsetEntityArchetype(world, entity)
}

export function set<$Type extends Type.Type>(
  world: World,
  entity: Entity.Entity,
  layout: $Type,
  init: Component.ComponentSetInit<$Type> = [] as unknown as Component.ComponentSetInit<$Type>,
) {
  let next: Archetype.Table
  const prev = tryGetEntityTable(world, entity)
  const components = Component.makeComponentSet(world, layout, init)
  // Entity either doesn't exist, or was previously destroyed.
  if (prev === undefined) {
    // Insert the entity into an archetype defined by the provided layout.
    const type = Type.normalize(layout)
    next = Graph.findOrMake(world, type)
    Archetype.insert(next, entity, components)
  } else {
    // Move the entity to an archetype that is the combination of the entity's
    // existing type and the provided layout.
    const type = Type.and(prev.type, layout)
    next = Graph.findOrMake(world, type)
    if (prev === next) {
      Archetype.write(entity, prev, components)
    } else {
      Archetype.move(entity, prev, next, components)
    }
  }
  setEntityTable(world, entity, next)
}

export function unset<$Type extends Type.Type>(
  world: World,
  entity: Entity.Entity,
  layout: $Type,
) {
  const prev = getEntityTable(world, entity)
  const type = Type.xor(prev.type, layout)
  const next = Graph.findOrMake(world, type)
  Archetype.move(entity, prev, next)
}

export function makeEntity<$Type extends Type.Type>(
  world: World,
  layout: $Type = [] as unknown as $Type,
  init: Archetype.Row<$Type> = Component.expressType(world, layout),
) {
  const entity = reserveEntity(world)
  set(world, entity, layout, init)
  return entity
}
