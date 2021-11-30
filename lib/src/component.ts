import * as Archetype from "./archetype"
import * as Schema from "./schema"
import * as Type from "./type"
import * as World from "./world"

export function expressBinaryShape<$Shape extends Schema.Shape<Schema.AnyBinarySchema>>(
  shape: $Shape,
): Archetype.BinaryData<$Shape> {
  if (Schema.isFormat(shape)) {
    return 0 as Archetype.BinaryData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = 0
  }
  return object as Archetype.BinaryData<$Shape>
}

export function expressNativeShape<$Shape extends Schema.Shape<Schema.AnyNativeSchema>>(
  shape: $Shape,
): Archetype.NativeData<$Shape> {
  if (Schema.isFormat(shape)) {
    return 0 as Archetype.NativeData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = 0
  }
  return object as Archetype.NativeData<$Shape>
}

export function expressSchema<$Schema extends Schema.AnySchema>(schema: $Schema) {
  switch (schema.kind) {
    case Schema.SchemaKind.BinaryScalar:
    case Schema.SchemaKind.BinaryStruct:
      return expressBinaryShape(schema.shape)
    case Schema.SchemaKind.NativeScalar:
    case Schema.SchemaKind.NativeObject:
      return expressNativeShape(schema.shape)
    default:
      return undefined
  }
}

export function expressType<$Type extends Type.Struct>(
  world: World.Struct,
  type: $Type,
): Archetype.RowData<$Type> {
  return type.map(id =>
    expressSchema(World.findSchemaById(world, id)),
  ) as unknown as Archetype.RowData<$Type>
}
