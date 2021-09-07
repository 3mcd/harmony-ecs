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

export type InstanceOf<$Ctor> = $Ctor extends { new (): infer _ } ? _ : never

declare class OpaqueTag<$Tag> {
  protected tag: $Tag;
}

export type Opaque<$Type, $Tag> = $Type & OpaqueTag<$Tag>;
