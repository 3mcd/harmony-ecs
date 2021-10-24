import { ArchetypeRow, BinaryData, Data, NativeData } from "./archetype"
import { invariant } from "./debug"
import {
  BinarySchema,
  isBinarySchema,
  isFormat,
  NativeSchema,
  Schema,
  SchemaId,
  Shape,
} from "./model"
import { Type } from "./type"
import { findSchemaById, World } from "./world"

export type ComponentSet = Data<SchemaId>[]
export type ComponentSetInit<$Type extends Type = Type> = {
  [K in keyof $Type]?: ArchetypeRow<$Type>[K]
}

export function expressBinaryShape<$Shape extends Shape<BinarySchema>>(
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

export function expressNativeShape<$Shape extends Shape<NativeSchema>>(
  shape: $Shape,
): NativeData<$Shape> {
  if (isFormat(shape)) {
    return 0 as NativeData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = isFormat(shape)
      ? 0
      : expressNativeShape(shape[key] as unknown as Shape<NativeSchema>)
  }
  return object as NativeData<$Shape>
}

export function expressSchema<$Schema extends Schema>(schema: $Schema) {
  return isBinarySchema(schema)
    ? expressBinaryShape(schema.shape)
    : expressNativeShape(schema.shape)
}

export function expressType<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeRow<$Type> {
  return type.map(id =>
    expressSchema(findSchemaById(world, id)),
  ) as unknown as ArchetypeRow<$Type>
}

export function makeComponentSet(
  world: World,
  type: Type,
  data: ComponentSetInit,
): ComponentSet {
  const set: ComponentSet = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    set[id] = data[i] ?? expressSchema(findSchemaById(world, id))
  }
  return set
}
