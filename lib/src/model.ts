import { Entity } from "./entity"
import { internal$harmonyFormat } from "./internal"
import { Opaque, TypedArrayConstructor } from "./types"
import { registerSchema, reserveEntity, World } from "./world"

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
  BinaryScalar,
  BinaryStruct,
  NativeScalar,
  NativeObject,
}

export type BinaryScalarSchema<$Shape extends Format = Format> = {
  id: number
  kind: SchemaKind.BinaryScalar
  shape: $Shape
}

export type BinaryStructSchema<
  $Shape extends { [key: string]: Format } = { [key: string]: Format },
> = {
  id: number
  kind: SchemaKind.BinaryStruct
  shape: $Shape
}

export type NativeScalarSchema<$Shape extends Format = Format> = {
  id: number
  kind: SchemaKind.NativeScalar
  shape: $Shape
}

type NativeObjectShape = { [key: string]: Format | Shape<NativeObjectSchema> }

export type NativeObjectSchema<$Shape extends NativeObjectShape = NativeObjectShape> = {
  id: number
  kind: SchemaKind.NativeObject
  shape: $Shape
}

export type BinarySchema = BinaryScalarSchema | BinaryStructSchema
export type NativeSchema = NativeScalarSchema | NativeObjectSchema
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
  $Shape extends Shape<BinaryScalarSchema>
    ? SchemaId<BinaryScalarSchema<$Shape>>
    : $Shape extends Shape<BinaryStructSchema>
    ? SchemaId<BinaryStructSchema<$Shape>>
    : never

type DeriveNativeSchema<$Shape extends Shape<NativeSchema>> =
  $Shape extends Shape<NativeScalarSchema>
    ? SchemaId<NativeScalarSchema<$Shape>>
    : $Shape extends Shape<NativeObjectSchema>
    ? SchemaId<NativeObjectSchema<$Shape>>
    : never

export function isFormat(object: object): object is Format {
  return internal$harmonyFormat in object
}

export function isBinarySchema(schema: Schema): schema is BinarySchema {
  return (
    schema.kind === SchemaKind.BinaryScalar || schema.kind === SchemaKind.BinaryStruct
  )
}

export function isNativeSchema(schema: Schema): schema is NativeSchema {
  return (
    schema.kind === SchemaKind.NativeScalar || schema.kind === SchemaKind.NativeObject
  )
}

export function makeBinarySchema<$Shape extends Shape<BinarySchema>>(
  world: World,
  shape: $Shape,
  reserve?: number,
): DeriveBinarySchema<$Shape> {
  const id = reserveEntity(world, reserve)
  let schema: BinarySchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.BinaryScalar, shape }
  } else {
    schema = { id, kind: SchemaKind.BinaryStruct, shape }
  }
  registerSchema(world, id, schema)
  return id as DeriveBinarySchema<$Shape>
}
export function makeSchema<$Shape extends Shape<NativeSchema>>(
  world: World,
  shape: $Shape,
  reserve?: number,
): DeriveNativeSchema<$Shape> {
  const id = reserveEntity(world, reserve)
  let schema: NativeSchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.NativeScalar, shape }
  } else {
    schema = { id, kind: SchemaKind.NativeObject, shape }
  }
  registerSchema(world, id, schema)
  return id as DeriveNativeSchema<$Shape>
}
