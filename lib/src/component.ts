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
    object[key] = Schema.isFormat(shape)
      ? 0
      : expressNativeShape(shape[key] as unknown as Schema.Shape<Schema.AnyNativeSchema>)
  }
  return object as Archetype.NativeData<$Shape>
}

export function expressSchema<$Schema extends Schema.AnySchema>(schema: $Schema) {
  return Schema.isBinarySchema(schema)
    ? expressBinaryShape(schema.shape)
    : expressNativeShape(schema.shape)
}

export function expressType<$Signature extends Type.Struct>(
  world: World.Struct,
  type: $Signature,
): Archetype.RowData<$Signature> {
  return type.map(id =>
    expressSchema(World.findSchemaById(world, id)),
  ) as unknown as Archetype.RowData<$Signature>
}
