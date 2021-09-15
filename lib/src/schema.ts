import { Entity } from "./entity"
import { internal$harmonyFormat } from "./internal"
import { Opaque, TypedArrayConstructor } from "./types"
import { registerSchema, reserveEntity, World } from "./world"

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
  BinarySimple,
  BinaryComplex,
  NativeSimple,
  NativeComplex,
}

export type SimpleBinarySchema<$Shape extends Format = Format> = {
  id: number
  kind: SchemaKind.BinarySimple
  shape: $Shape
}
export type ComplexBinarySchema<
  $Shape extends { [key: string]: Format } = { [key: string]: Format },
> = {
  id: number
  kind: SchemaKind.BinaryComplex
  shape: $Shape
}
export type SimpleNativeSchema<$Shape extends Format = Format> = {
  id: number
  kind: SchemaKind.NativeSimple
  shape: $Shape
}
export type ComplexNativeSchema<
  $Shape extends { [key: string]: Format | Shape<ComplexNativeSchema> } = {
    [key: string]: Format | Shape<ComplexNativeSchema>
  },
> = {
  id: number
  kind: SchemaKind.NativeComplex
  shape: $Shape
}
export type BinarySchema = SimpleBinarySchema | ComplexBinarySchema
export type NativeSchema = SimpleNativeSchema | ComplexNativeSchema
export type Schema = BinarySchema | NativeSchema
export type Shape<$Type extends { shape: unknown }> = $Type["shape"]
export type SchemaId<$Schema extends Schema = Schema> = Opaque<Entity, $Schema>

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

type DeriveBinarySchema<$Shape extends Shape<BinarySchema>> =
  $Shape extends Shape<SimpleBinarySchema>
    ? SchemaId<SimpleBinarySchema<$Shape>>
    : $Shape extends Shape<ComplexBinarySchema>
    ? SchemaId<ComplexBinarySchema<$Shape>>
    : never

type DeriveNativeSchema<$Shape extends Shape<NativeSchema>> =
  $Shape extends Shape<SimpleNativeSchema>
    ? SchemaId<SimpleNativeSchema<$Shape>>
    : $Shape extends Shape<ComplexNativeSchema>
    ? SchemaId<ComplexNativeSchema<$Shape>>
    : never

// helpers
export function isFormat(object: object): object is Format {
  return internal$harmonyFormat in object
}

export function makeBinarySchema<$Shape extends Shape<BinarySchema>>(
  world: World,
  shape: $Shape,
  schemaId?: number,
): DeriveBinarySchema<$Shape> {
  const id = reserveEntity(world, schemaId)
  let schema: BinarySchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.BinarySimple, shape }
  } else {
    schema = { id, kind: SchemaKind.BinaryComplex, shape }
  }
  registerSchema(world, id, schema)
  return id as DeriveBinarySchema<$Shape>
}
export function makeSchema<$Shape extends Shape<NativeSchema>>(
  world: World,
  shape: $Shape,
  schemaId?: number,
): DeriveNativeSchema<$Shape> {
  const id = reserveEntity(world, schemaId)
  let schema: NativeSchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.NativeSimple, shape }
  } else {
    schema = { id, kind: SchemaKind.NativeComplex, shape }
  }
  registerSchema(world, id, schema)
  return id as DeriveNativeSchema<$Shape>
}

export function isBinarySchema(schema: Schema): schema is BinarySchema {
  return (
    schema.kind === SchemaKind.BinarySimple || schema.kind === SchemaKind.BinaryComplex
  )
}

export function isNativeSchema(schema: Schema): schema is NativeSchema {
  return (
    schema.kind === SchemaKind.NativeSimple || schema.kind === SchemaKind.NativeComplex
  )
}
