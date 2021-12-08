import * as Format from "./format"

export enum Type {
  Binary,
  Object,
  Scalar,
}

export type ScalarShape = Format.Struct
export type ObjectShape = { [key: string]: Format.Struct }
export type Shape = ScalarShape | ObjectShape

export type StructBinary<S extends ObjectShape = ObjectShape> = {
  type: Type.Binary
  shape: S
}

export type StructObject<S extends ObjectShape = ObjectShape> = {
  type: Type.Object
  shape: S
}

export type StructScalar<S extends Format.Struct = Format.Struct> = {
  type: Type.Scalar
  shape: S
}

export type Struct = StructBinary | StructObject | StructScalar

export type Express<S extends Struct> = S extends StructScalar<Format.Struct>
  ? number
  : { [K in keyof S["shape"]]: number }
