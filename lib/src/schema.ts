import * as Entity from "./entity"
import * as Format from "./format"
import * as Symbols from "./symbols"
import * as Types from "./types"
import * as World from "./world"

/** @internal */
export enum SchemaKind {
  NativeScalar,
  NativeObject,
  BinaryScalar,
  BinaryStruct,
  Tag,
}

/** @internal */
export type NativeScalarSchema<$Shape extends Format.Format = Format.Format> = {
  id: number
  kind: SchemaKind.NativeScalar
  shape: $Shape
}

/** @internal */
type NativeObjectShape = { [key: string]: Format.Format | Shape<NativeObjectSchema> }

/** @internal */
export type NativeObjectSchema<$Shape extends NativeObjectShape = NativeObjectShape> = {
  id: number
  kind: SchemaKind.NativeObject
  shape: $Shape
}

/** @internal */
export type BinaryScalarSchema<$Shape extends Format.Format = Format.Format> = {
  id: number
  kind: SchemaKind.BinaryScalar
  shape: $Shape
}

/** @internal */
export type BinaryStructSchema<
  $Shape extends { [key: string]: Format.Format } = { [key: string]: Format.Format },
> = {
  id: number
  kind: SchemaKind.BinaryStruct
  shape: $Shape
}

/** @internal */
export type TagSchema = {
  id: number
  kind: SchemaKind.Tag
  shape: null
}

/** @internal */
export type AnyNativeSchema = NativeScalarSchema | NativeObjectSchema
/** @internal */
export type AnyBinarySchema = BinaryScalarSchema | BinaryStructSchema
/** @internal */
export type ComplexSchema = AnyBinarySchema | AnyNativeSchema
/** @internal */
export type AnySchema = ComplexSchema | TagSchema
/** @internal */
export type Shape<$Signature extends { shape: unknown }> = $Signature["shape"]

/**
 * An entity id wrapped in a generic type that allows Harmony to infer the
 * component shape from the underlying primitive type.
 */
export type Id<$Schema extends AnySchema = AnySchema> = Types.Opaque<Entity.Id, $Schema>

/**
 * A schema whose components are standard JavaScript objects or scalar values.
 * Unlike binary components, native components are stored in an array-of-
 * structs architecture.
 */
export type NativeSchema<$Shape extends Shape<AnyNativeSchema>> =
  $Shape extends Shape<NativeScalarSchema>
    ? Id<NativeScalarSchema<$Shape>>
    : $Shape extends Shape<NativeObjectSchema>
    ? Id<NativeObjectSchema<$Shape>>
    : never

/**
 * A schema whose components are stored in one or more TypedArrays. If the
 * schema shape is complex (i.e non-scalar), derived components will be stored
 * in a struct-of-array architecture, where each component field is allocated a
 * separate, tightly-packed TypedArray.
 */
export type BinarySchema<$Shape extends Shape<AnyBinarySchema>> =
  $Shape extends Shape<BinaryScalarSchema>
    ? Id<BinaryScalarSchema<$Shape>>
    : $Shape extends Shape<BinaryStructSchema>
    ? Id<BinaryStructSchema<$Shape>>
    : never

/** @internal */
export function isFormat(object: object): object is Format.Format {
  return Symbols.$format in object
}

/** @internal */
export function isNativeSchema(schema: ComplexSchema): schema is AnyNativeSchema {
  return (
    schema.kind === SchemaKind.NativeScalar || schema.kind === SchemaKind.NativeObject
  )
}

/** @internal */
export function isBinarySchema(schema: ComplexSchema): schema is AnyBinarySchema {
  return (
    schema.kind === SchemaKind.BinaryScalar || schema.kind === SchemaKind.BinaryStruct
  )
}

/**
 * Create a native schema. Returns an id that can be used to reference the
 * schema throughout Harmony's API.
 *
 * @example <caption>Create a scalar native schema</caption>
 * ```ts
 * const Health = Schema.make(world, Format.uint32)
 * ```
 * @example <caption>Create a complex native schema</caption>
 * ```ts
 * const Position = Schema.make(world, {
 *   x: Format.float64,
 *   y: Format.float64
 * })
 * ```
 */
export function make<$Shape extends Shape<AnyNativeSchema>>(
  world: World.Struct,
  shape: $Shape,
  reserve?: number,
): NativeSchema<$Shape> {
  const id = Entity.reserve(world, reserve)
  let schema: AnyNativeSchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.NativeScalar, shape }
  } else {
    schema = { id, kind: SchemaKind.NativeObject, shape }
  }
  World.registerSchema(world, id, schema)
  return id as NativeSchema<$Shape>
}

/**
 * Create a binary schema. Returns an id that is used to reference the schema
 * throughout Harmony's API.
 *
 * @example <caption>Create a scalar binary schema</caption>
 * ```ts
 * const Health = Schema.makeBinary(world, Format.uint32)
 * ```
 * @example <caption>Create a complex binary schema</caption>
 * ```ts
 * const Position = Schema.makeBinary(world, {
 *   x: Format.float64,
 *   y: Format.float64
 * })
 * ```
 */
export function makeBinary<$Shape extends Shape<AnyBinarySchema>>(
  world: World.Struct,
  shape: $Shape,
  reserve?: number,
): BinarySchema<$Shape> {
  const id = Entity.reserve(world, reserve)
  let schema: AnyBinarySchema
  if (isFormat(shape)) {
    schema = { id, kind: SchemaKind.BinaryScalar, shape }
  } else {
    schema = { id, kind: SchemaKind.BinaryStruct, shape }
  }
  World.registerSchema(world, id, schema)
  return id as BinarySchema<$Shape>
}

/**
 * Create a tag schema – a data-less, lightweight component type that is faster
 * than complex or scalar components since there is no data to copy when moving
 * an entity between archetypes.
 *
 * Returns an id that is used to reference the schema throughout Harmony's API.
 *
 * @example <caption>Create a tag schema</caption>
 * ```ts
 * const Frozen = Schema.makeTag(world)
 * ```
 */
export function makeTag(world: World.Struct, reserve?: number): Id<TagSchema> {
  const id = Entity.reserve(world, reserve)
  World.registerSchema(world, id, { id, kind: SchemaKind.Tag, shape: null })
  return id as Id<TagSchema>
}
