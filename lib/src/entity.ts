import {
  ArchetypeDataOf,
  BinaryDataOf,
  insertIntoArchetype,
  NativeDataOf,
  Type,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { Registry } from "./registry"
import {
  AnySchema,
  BinarySchema,
  isBinarySchema,
  isFormat,
  NativeSchema,
  ShapeOf,
} from "./schema"

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
function initializeType<$Type extends Type>(type: $Type): ArchetypeDataOf<$Type> {
  return type.map(initializeSchema) as unknown as ArchetypeDataOf<$Type>
}

export function attach<$Type extends Type>(
  registry: Registry,
  entity: Entity,
  type: $Type,
  data?: ArchetypeDataOf<$Type>,
) {
  const archetype = findOrMakeArchetype(registry, type)
  insertIntoArchetype(archetype, entity, data ?? initializeType(type))
}
export function detach(registry: Registry, entity: Entity, type: Type) {}
