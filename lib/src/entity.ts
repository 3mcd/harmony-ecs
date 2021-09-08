import {
  ArchetypeDataOf,
  BinaryDataOf,
  DataOf,
  insertIntoArchetype,
  moveToArchetype,
  NativeDataOf,
  removeFromArchetype,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { invariant } from "./debug"
import {
  AnySchema,
  BinarySchema,
  isBinarySchema,
  isFormat,
  NativeSchema,
  SchemaId,
  SchemaOfId,
  ShapeOf,
} from "./schema"
import { addToType, removeFromType, Type } from "./type"
import { World } from "./world"

export type Entity = number

function initializeBinaryShape<$Shape extends ShapeOf<BinarySchema>>(
  shape: $Shape,
): BinaryDataOf<$Shape> {
  if (isFormat(shape)) {
    return 0 as BinaryDataOf<$Shape>
  }
  const struct: { [key: string]: unknown } = {}
  for (const key in shape) {
    struct[key] = 0
  }
  return struct as BinaryDataOf<$Shape>
}

function initializeNativeShape<$Shape extends ShapeOf<NativeSchema>>(
  shape: $Shape,
): NativeDataOf<$Shape> {
  if (isFormat(shape)) {
    return 0 as NativeDataOf<$Shape>
  }
  const struct: { [key: string]: unknown } = {}
  for (const key in shape) {
    struct[key] = isFormat(shape)
      ? 0
      : initializeNativeShape(shape[key] as unknown as ShapeOf<NativeSchema>)
  }
  return struct as NativeDataOf<$Shape>
}

function initializeSchema<$Schema extends AnySchema>(schema: $Schema) {
  return isBinarySchema(schema)
    ? initializeBinaryShape(schema.shape)
    : initializeNativeShape(schema.shape)
}

function initializeType<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeDataOf<$Type> {
  return type.map(id =>
    initializeSchema(world.schemaIndex[id]),
  ) as unknown as ArchetypeDataOf<$Type>
}

export function makeEntity<$Type extends Type>(
  world: World,
  type: $Type,
  data: ArchetypeDataOf<$Type> = initializeType(world, type),
) {
  const entity = world.entityHead++
  const archetype = findOrMakeArchetype(world, type)
  insertIntoArchetype(world, archetype, entity, data)
  world.entityIndex[entity] = archetype
  return entity
}

export function destroyEntity(world: World, entity: Entity) {
  const prev = world.entityIndex[entity]
  invariant(prev !== undefined)
  removeFromArchetype(world, prev, entity)
}

export function set<$SchemaId extends SchemaId>(
  world: World,
  entity: Entity,
  id: $SchemaId,
  data?: DataOf<ShapeOf<SchemaOfId<$SchemaId>>>,
) {
  const schema = world.schemaIndex[id]
  const final =
    data ?? (initializeSchema(schema) as DataOf<ShapeOf<SchemaOfId<$SchemaId>>>)
  const prev = world.entityIndex[entity]
  if (prev === undefined) {
    const archetype = findOrMakeArchetype(world, [id])
    insertIntoArchetype(world, archetype, entity, [final])
    world.entityIndex[entity] = archetype
  } else {
    const next = prev.edgesSet[id] ?? findOrMakeArchetype(world, addToType(prev.type, id))
    moveToArchetype(world, prev, next, entity, schema, final)
    world.entityIndex[entity] = next
  }
}

export function unset<$SchemaId extends SchemaId>(
  world: World,
  entity: Entity,
  id: $SchemaId,
) {
  const prev = world.entityIndex[entity]
  invariant(prev !== undefined)
  const next =
    prev.edgesUnset[id] ?? findOrMakeArchetype(world, removeFromType(prev.type, id))
  moveToArchetype(world, prev, next, entity)
  world.entityIndex[entity] = next
}
