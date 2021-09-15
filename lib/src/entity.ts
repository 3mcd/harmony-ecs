import {
  ArchetypeData,
  BinaryData,
  Data,
  insertIntoArchetype,
  moveToArchetype,
  NativeData,
  removeFromArchetype,
  traverseSet,
  traverseUnset,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { invariant } from "./debug"
import {
  Schema,
  BinarySchema,
  isBinarySchema,
  isFormat,
  NativeSchema,
  SchemaId,
  Shape,
} from "./schema"
import { addToType, normalizeType, removeFromType, Type } from "./type"
import {
  findSchemaById,
  getEntityLocation,
  reserveEntity,
  setEntityArchetype,
  tryGetEntityArchetype,
  unsetEntityArchetype,
  World,
} from "./world"

export type Entity = number

function initializeBinaryShape<$Shape extends Shape<BinarySchema>>(
  shape: $Shape,
): BinaryData<$Shape> {
  if (isFormat(shape)) {
    return 0 as BinaryData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = 0
  }
  return object as BinaryData<$Shape>
}

function initializeNativeShape<$Shape extends Shape<NativeSchema>>(
  shape: $Shape,
): NativeData<$Shape> {
  if (isFormat(shape)) {
    return 0 as NativeData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = isFormat(shape)
      ? 0
      : initializeNativeShape(shape[key] as unknown as Shape<NativeSchema>)
  }
  return object as NativeData<$Shape>
}

function initializeSchema<$Schema extends Schema>(schema: $Schema) {
  return isBinarySchema(schema)
    ? initializeBinaryShape(schema.shape)
    : initializeNativeShape(schema.shape)
}

function initializeType<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeData<$Type> {
  return type.map(id =>
    initializeSchema(findSchemaById(world, id)),
  ) as unknown as ArchetypeData<$Type>
}

export function makeEntity<$Type extends Type>(
  world: World,
  layout: $Type,
  data: ArchetypeData<$Type> = initializeType(world, layout),
) {
  const type = normalizeType(layout)
  const entity = reserveEntity(world)
  const archetype = findOrMakeArchetype(world, type)
  insertIntoArchetype(archetype, entity, data)
  setEntityArchetype(world, entity, archetype)
  return entity
}

export function deleteEntity(world: World, entity: Entity) {
  const prev = world.entityIndex[entity]
  invariant(prev !== undefined)
  removeFromArchetype(prev, entity)
  unsetEntityArchetype(world, entity)
}

export function set<$SchemaId extends SchemaId>(
  world: World,
  entity: Entity,
  schemaId: $SchemaId,
  data?: Data<$SchemaId>,
) {
  const schema = findSchemaById(world, schemaId)
  const final = data ?? (initializeSchema(schema) as Data<$SchemaId>)
  const prev = tryGetEntityArchetype(world, entity)
  if (prev === undefined) {
    const identity = findOrMakeArchetype(world, [schemaId])
    insertIntoArchetype(identity, entity, [final])
    setEntityArchetype(world, entity, identity)
  } else {
    const next =
      traverseSet(prev, schemaId) ??
      findOrMakeArchetype(world, addToType(prev.type, schemaId))
    moveToArchetype(prev, next, entity, schemaId, final)
    setEntityArchetype(world, entity, next)
  }
}

export function unset<$SchemaId extends SchemaId>(
  world: World,
  entity: Entity,
  id: $SchemaId,
) {
  const prev = getEntityLocation(world, entity)
  const next =
    traverseUnset(prev, id) ?? findOrMakeArchetype(world, removeFromType(prev.type, id))
  moveToArchetype(prev, next, entity)
  setEntityArchetype(world, entity, next)
}
