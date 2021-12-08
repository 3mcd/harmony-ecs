import * as Format from "./types"
import * as Symbols from "./symbols"

export enum Kind {
  Uint8,
  Uint16,
  Uint32,
  Int8,
  Int16,
  Int32,
  Float32,
  Float64,
}

/**
 * Number format. Encloses a TypedArray constructor which corresponds to the
 * format kind, (e.g. `FormatKind.Uint8`->`Uint8Array`).
 */
export type Struct<
  $Kind extends Kind = Kind,
  $Binary extends Format.TypedArrayConstructor = Format.TypedArrayConstructor,
> = { kind: $Kind; binary: $Binary }

function makeFormat<$Kind extends Kind, $Binary extends Format.TypedArrayConstructor>(
  kind: $Kind,
  binary: $Binary,
): Struct<$Kind, $Binary> {
  return {
    [Symbols.$format]: true,
    kind,
    binary,
  } as { kind: $Kind; binary: $Binary }
}

export const float32 = makeFormat(Kind.Float32, Float32Array)
export const float64 = makeFormat(Kind.Float64, Float64Array)
export const uint8 = makeFormat(Kind.Uint8, Uint8Array)
export const uint16 = makeFormat(Kind.Uint16, Uint16Array)
export const uint32 = makeFormat(Kind.Uint32, Uint32Array)
export const int8 = makeFormat(Kind.Int8, Int8Array)
export const int16 = makeFormat(Kind.Int16, Int16Array)
export const int32 = makeFormat(Kind.Int32, Int32Array)

export function isFormat(object: object): object is Struct {
  return Symbols.$format in object
}
