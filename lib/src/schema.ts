import {
  internal$javelinFormat,
  internalReserveSchemaId,
  internalSchemaIndex
} from "./internal"
import { TypedArrayConstructor } from "./types"

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
  kind: SchemaKind.Binary
  shape: Format | { [key: string]: Format }
}
export type NativeSchema = {
  kind: SchemaKind.Native
  shape: Format | { [key: string]: NativeSchema["shape"] }
}
export type AnySchema = BinarySchema | NativeSchema
export type ShapeOf<$Schema extends AnySchema> = $Schema["shape"]

function makeFormat<$Kind extends FormatKind, $Binary extends TypedArrayConstructor>(
  kind: $Kind,
  binary: $Binary,
) {
  return {
    [internal$javelinFormat]: true,
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
export function makeBinarySchema<$Shape extends BinarySchema["shape"]>(
  shape: $Shape,
  schemaId?: number,
) {
  const schema = { kind: SchemaKind.Binary as const, shape }
  internalSchemaIndex.set(schema, internalReserveSchemaId(schemaId))
  return schema
}
export function makeSchema<$Shape extends NativeSchema["shape"]>(
  shape: $Shape,
  schemaId?: number,
) {
  const schema = { kind: SchemaKind.Native as const, shape }
  internalSchemaIndex.set(schema, internalReserveSchemaId(schemaId))
  return schema
}

export function getSchemaId(schema: AnySchema) {
  const schemaId = internalSchemaIndex.get(schema)
  if (schemaId === undefined) {
    throw new TypeError("object is not a registered schema")
  }
  return schemaId
}

export function isFormat(object: object): object is Format {
  return internal$javelinFormat in object
}

export function isBinarySchema(schema: AnySchema): schema is BinarySchema {
  return schema.kind === SchemaKind.Binary
}

export function isNativeSchema(schema: AnySchema): schema is NativeSchema {
  return schema.kind === SchemaKind.Native
}
