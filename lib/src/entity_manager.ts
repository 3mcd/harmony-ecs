import { set, unset, World } from "."
import { DataOf } from "./archetype"
import { Entity } from "./entity"
import { SchemaId, SchemaOfId, ShapeOf } from "./schema"

type SetData = DataOf<ShapeOf<SchemaOfId<SchemaId>>>

export type EntityManager = {
  set: Entity[]
  setData: Map<SchemaId, SetData>[]
  setIndex: Entity[]
  unset: Entity[]
  unsetData: Set<SchemaId>[]
  unsetIndex: Entity[]
}

export function makeEntityManager(): EntityManager {
  return {
    set: [],
    setData: [],
    setIndex: [],
    unset: [],
    unsetData: [],
    unsetIndex: [],
  }
}

export function deferSet<$SchemaId extends SchemaId>(
  manager: EntityManager,
  entity: Entity,
  schemaId: $SchemaId,
  data: DataOf<ShapeOf<SchemaOfId<$SchemaId>>> | null = null,
) {
  let entitySetIndex = manager.setIndex[entity]
  let entitySetData = manager.setData[entity]

  if (entitySetIndex === undefined) {
    entitySetIndex = manager.setIndex[entity] = manager.set.push(entity) - 1
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
    entityUnsetIndex = manager.unsetIndex[entity] = manager.unset.push(entity) - 1
  }

  if (entityUnsetData === undefined) {
    entityUnsetData = manager.unsetData[entity] = new Set()
  }

  entityUnsetData.add(schemaId)
}

export function applyDeferredOps(world: World, manager: EntityManager) {
  let i = manager.set.length
  while (--i >= 0) {
    const entity = manager.set.pop()
    const entitySetData = manager.setData[entity]
    entitySetData.forEach((data, schemaId) => set(world, entity, schemaId, data))
    entitySetData.clear()
    manager.setIndex[entity] = undefined
  }
  i = manager.unset.length
  while (--i >= 0) {
    const entity = manager.unset.pop()
    const entityUnsetData = manager.unsetData[entity]
    entityUnsetData.forEach(schemaId => unset(world, entity, schemaId))
    entityUnsetData.clear()
    manager.unsetIndex[entity] = undefined
  }
}
