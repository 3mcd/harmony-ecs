import { Entity } from "./entity"
import { internal$harmonyFormat } from "./internal"
import { Opaque, TypedArrayConstructor } from "./types"
import { World } from "./world"

// types
export enum FormatKind {
  Uint8,
  Uint16,
  Uint32,
  Int8,
  Int16,
  Int32,
  Float32,
  Float64,
}
export type Format = {
  kind: FormatKind
  binary: TypedArrayConstructor
}

export enum SchemaKind {
  Binary,
  Native,
}

export type BinarySchema = {
  id: number
  kind: SchemaKind.Binary
  shape: Format | { [key: string]: Format }
}
export type NativeSchema = {
  id: number
  kind: SchemaKind.Native
  shape: Format | { [key: string]: ShapeOf<NativeSchema> }
}
export type BinarySchemaOf<$Shape extends ShapeOf<BinarySchema>> = {
  id: number
  kind: SchemaKind.Binary
  shape: $Shape
}
export type NativeSchemaOf<$Shape extends ShapeOf<NativeSchema>> = {
  id: number
  kind: SchemaKind.Native
  shape: $Shape
}
export type AnySchema = BinarySchema | NativeSchema
export type ShapeOf<$Type extends { shape: unknown }> = $Type["shape"]
export type SchemaId<$Schema extends AnySchema = AnySchema> = Opaque<Entity, $Schema>
export type SchemaOfId<$SchemaId extends SchemaId> = $SchemaId extends SchemaId<
  infer $Schema
>
  ? $Schema
  : never

function makeFormat<$Kind extends FormatKind, $Binary extends TypedArrayConstructor>(
  kind: $Kind,
  binary: $Binary,
) {
  return {
    [internal$harmonyFormat]: true,
    kind,
    binary,
  } as { kind: $Kind; binary: $Binary }
}

// formats
const float32 = makeFormat(FormatKind.Float32, Float32Array)
const float64 = makeFormat(FormatKind.Float64, Float64Array)
const uint8 = makeFormat(FormatKind.Uint8, Uint8Array)
const uint16 = makeFormat(FormatKind.Uint16, Uint16Array)
const uint32 = makeFormat(FormatKind.Uint32, Uint32Array)
const int8 = makeFormat(FormatKind.Int8, Int8Array)
const int16 = makeFormat(FormatKind.Int16, Int16Array)
const int32 = makeFormat(FormatKind.Int32, Int32Array)
export const formats = {
  float32,
  float64,
  uint8,
  uint16,
  uint32,
  int8,
  int16,
  int32,
}

// helpers
export function makeBinarySchema<$Shape extends ShapeOf<BinarySchema>>(
  world: World,
  shape: $Shape,
  schemaId?: number,
): SchemaId<BinarySchemaOf<$Shape>> {
  if (world.entityHead >= schemaId) {
    throw new RangeError("id already reserved")
  }
  const id = world.entityHead++
  const schema = { id, kind: SchemaKind.Binary as const, shape }
  world.schemaIndex[id] = schema
  return id as SchemaId<BinarySchemaOf<$Shape>>
}
export function makeSchema<$Shape extends ShapeOf<NativeSchema>>(
  world: World,
  shape: $Shape,
  schemaId?: number,
): SchemaId<NativeSchemaOf<$Shape>> {
  if (world.entityHead >= schemaId) {
    throw new RangeError("id already reserved")
  }
  const id = world.entityHead++
  const schema = { id, kind: SchemaKind.Native as const, shape }
  world.schemaIndex[id] = schema
  return id as SchemaId<NativeSchemaOf<$Shape>>
}

export function isFormat(object: object): object is Format {
  return internal$harmonyFormat in object
}

export function isBinarySchema(schema: AnySchema): schema is BinarySchema {
  return schema.kind === SchemaKind.Binary
}

export function isNativeSchema(schema: AnySchema): schema is NativeSchema {
  return schema.kind === SchemaKind.Native
}
