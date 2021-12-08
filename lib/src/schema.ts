import * as Format from "./format"

export enum Type {
  Binary,
  Object,
  Scalar,
}

export type ScalarShape = Format.Struct
export type ObjectShape = { [key: string]: Format.Struct }
export type Shape = ScalarShape | ObjectShape

export type StructObjectBinary<S extends ObjectShape = ObjectShape> = {
  type: Type.Binary
  shape: S
  keys: string[]
}

export type StructObject<S extends ObjectShape = ObjectShape> = {
  type: Type.Object
  shape: S
  keys: string[]
}

export type StructScalar<S extends Format.Struct = Format.Struct> = {
  type: Type.Scalar
  shape: S
}

export type Struct = StructObjectBinary | StructObject | StructScalar

export type Express<S extends Struct> = S extends StructScalar<Format.Struct>
  ? number
  : { [K in keyof S["shape"]]: number }

export function express<$Schema extends Struct>(schema: $Schema) {
  if (schema.type === Type.Scalar) {
    return 0
  }
  const object: { [key: string]: unknown } = {}
  for (let i = 0; i < schema.keys.length; i++) {
    object[schema.keys[i]] = 0
  }
  return object
}
