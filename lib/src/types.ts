export type Construct<$Ctor> = $Ctor extends { new (...args: any[]): infer _ } ? _ : never

export declare class Opaque<$Tag> {
  tag: $Tag
}

export type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array

export type TypedArrayConstructor = {
  new (length: number | ArrayBufferLike): TypedArray
  BYTES_PER_ELEMENT: number
}

export enum TypedArrayId {
  Uint8,
  Uint16,
  Uint32,
  Int8,
  Int16,
  Int32,
  Float32,
  Float64,
}

export const TYPED_ARRAY_CTOR_LOOKUP = new Map<TypedArrayId, TypedArrayConstructor>([
  [TypedArrayId.Uint8, Uint8Array],
  [TypedArrayId.Uint16, Uint16Array],
  [TypedArrayId.Uint32, Uint32Array],
  [TypedArrayId.Int8, Int8Array],
  [TypedArrayId.Int16, Int16Array],
  [TypedArrayId.Int32, Int32Array],
  [TypedArrayId.Float32, Float32Array],
  [TypedArrayId.Float64, Float64Array],
])

export const TYPED_ARRAY_ID_LOOKUP = new Map(
  Array.from(TYPED_ARRAY_CTOR_LOOKUP).map(([typedArrayIdKey, typedArrayCtor]) => [
    typedArrayCtor as TypedArrayConstructor,
    typedArrayIdKey,
  ]),
)
