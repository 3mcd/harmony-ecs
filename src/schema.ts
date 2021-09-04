import {
  internal$javelinFormat,
  internalReserveSchemaId,
  internalSchemaIndex,
} from "./internal"
import { TypedArrayConstructor } from "./types"

// types
export enum FormatKind {
  Float32,
  Float64,
}
export type Format = {
  [internal$javelinFormat]: FormatKind
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

// formats
const float32 = {
  [internal$javelinFormat]: FormatKind.Float32 as const,
  binary: Float32Array,
}
const float64 = {
  [internal$javelinFormat]: FormatKind.Float64 as const,
  binary: Float64Array,
}
export const formats = { float32, float64 }

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
