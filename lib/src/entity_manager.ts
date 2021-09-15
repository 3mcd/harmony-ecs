import { ArchetypeData, Data } from "./archetype"
import { invariant } from "./debug"
import { deleteEntity, Entity, makeEntity, set, unset } from "./entity"
import { SchemaId } from "./schema"
import { Type } from "./type"
import { World } from "./world"

type SetPayload = Data<SchemaId> | undefined
type MakePayload<$Type extends Type = Type> = [layout: $Type, data?: ArchetypeData<$Type>]

export type EntityManager = {
  setEntities: Entity[]
  setData: Map<SchemaId, SetPayload>[]
  setIndex: (Entity | undefined)[]
  unsetEntities: Entity[]
  unsetData: Set<SchemaId>[]
  unsetIndex: (Entity | undefined)[]
  makeData: MakePayload[]
  deleteEntities: Set<Entity>
}

export function makeEntityManager(): EntityManager {
  return {
    setEntities: [],
    setData: [],
    setIndex: [],
    unsetEntities: [],
    unsetData: [],
    unsetIndex: [],
    makeData: [],
    deleteEntities: new Set(),
  }
}

export function deferMakeEntity<$Type extends Type>(
  manager: EntityManager,
  layout: $Type,
  data?: ArchetypeData<$Type>,
) {
  manager.makeData.push([layout, data])
}

export function deferSet<$SchemaId extends SchemaId>(
  manager: EntityManager,
  entity: Entity,
  schemaId: $SchemaId,
  data?: Data<$SchemaId>,
) {
  let entitySetIndex = manager.setIndex[entity]
  let entitySetData = manager.setData[entity]

  if (entitySetIndex === undefined) {
    entitySetIndex = manager.setIndex[entity] = manager.setEntities.push(entity) - 1
  }

  if (entitySetData === undefined) {
    entitySetData = manager.setData[entity] = new Map()
  }

  entitySetData.set(schemaId, data)
}

export function deferUnset<$SchemaId extends SchemaId>(
  manager: EntityManager,
  entity: Entity,
  schemaId: $SchemaId,
) {
  let entityUnsetIndex = manager.unsetIndex[entity]
  let entityUnsetData = manager.unsetData[entity]

  if (entityUnsetIndex === undefined) {
    entityUnsetIndex = manager.unsetIndex[entity] = manager.unsetEntities.push(entity) - 1
  }

  if (entityUnsetData === undefined) {
    entityUnsetData = manager.unsetData[entity] = new Set()
  }

  entityUnsetData.add(schemaId)
}

export function deferDeleteEntity(manager: EntityManager, entity: Entity) {
  manager.deleteEntities.add(entity)
}

export function applyDeferredOps(world: World, manager: EntityManager) {
  let i = manager.setEntities.length
  while (--i >= 0) {
    const entity = manager.setEntities.pop()
    invariant(entity !== undefined)
    const entitySetData = manager.setData[entity]
    invariant(entitySetData !== undefined)
    entitySetData.forEach((data, schemaId) => set(world, entity, schemaId, data))
    entitySetData.clear()
    manager.setIndex[entity] = undefined
  }
  i = manager.unsetEntities.length
  while (--i >= 0) {
    const entity = manager.unsetEntities.pop()
    invariant(entity !== undefined)
    const entityUnsetData = manager.unsetData[entity]
    invariant(entityUnsetData !== undefined)
    entityUnsetData.forEach(schemaId => unset(world, entity, schemaId))
    entityUnsetData.clear()
    manager.unsetIndex[entity] = undefined
  }
  i = manager.makeData.length
  while (--i >= 0) {
    const payload = manager.makeData.pop()
    invariant(payload !== undefined)
    const [layout, data] = payload
    makeEntity(world, layout, data)
  }
  manager.deleteEntities.forEach(entity => deleteEntity(world, entity))
}
