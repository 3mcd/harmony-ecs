export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array

export type TypedArrayConstructor = {
  new (length: number | ArrayBufferLike): TypedArray
  BYTES_PER_ELEMENT: number
}

export type InstanceOf<$Ctor> = $Ctor extends { new (): infer _ } ? _ : never
