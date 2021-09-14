import {
  ArchetypeData,
  BinaryData,
  Data,
  insertIntoArchetype,
  moveToArchetype,
  NativeData,
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
  Shape,
} from "./schema"
import { addToType, normalizeType, removeFromType, Type } from "./type"
import { World } from "./world"

export type Entity = number

function initializeBinaryShape<$Shape extends Shape<BinarySchema>>(
  shape: $Shape,
): BinaryData<$Shape> {
  if (isFormat(shape)) {
    return 0 as BinaryData<$Shape>
  }
  const struct: { [key: string]: unknown } = {}
  for (const key in shape) {
    struct[key] = 0
  }
  return struct as BinaryData<$Shape>
}

function initializeNativeShape<$Shape extends Shape<NativeSchema>>(
  shape: $Shape,
): NativeData<$Shape> {
  if (isFormat(shape)) {
    return 0 as NativeData<$Shape>
  }
  const struct: { [key: string]: unknown } = {}
  for (const key in shape) {
    struct[key] = isFormat(shape)
      ? 0
      : initializeNativeShape(shape[key] as unknown as Shape<NativeSchema>)
  }
  return struct as NativeData<$Shape>
}

function initializeSchema<$Schema extends AnySchema>(schema: $Schema) {
  return isBinarySchema(schema)
    ? initializeBinaryShape(schema.shape)
    : initializeNativeShape(schema.shape)
}

function initializeType<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeData<$Type> {
  return type.map(id =>
    initializeSchema(world.schemaIndex[id]),
  ) as unknown as ArchetypeData<$Type>
}

export function makeEntity<$Type extends Type>(
  world: World,
  layout: $Type,
  data: ArchetypeData<$Type> = initializeType(world, layout),
) {
  const type = normalizeType(layout)
  const entity = world.entityHead++
  const archetype = findOrMakeArchetype(world, type)
  insertIntoArchetype(world, archetype, entity, data)
  world.entityIndex[entity] = archetype
  return entity
}

export function deleteEntity(world: World, entity: Entity) {
  const prev = world.entityIndex[entity]
  invariant(prev !== undefined)
  removeFromArchetype(world, prev, entity)
  world.entityIndex[entity] = null
}

export function set<$SchemaId extends SchemaId>(
  world: World,
  entity: Entity,
  id: $SchemaId,
  data?: Data<$SchemaId>,
) {
  const schema = world.schemaIndex[id]
  const final = data ?? initializeSchema(schema)
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
