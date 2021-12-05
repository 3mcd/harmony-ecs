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

export type Construct<$Ctor> = $Ctor extends { new (...args: any[]): infer _ } ? _ : never
