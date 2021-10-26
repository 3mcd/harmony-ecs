import * as Types from "./types"
import * as Symbols from "./symbols"

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

/**
 * Number format. Encloses a TypedArray constructor which corresponds to the
 * format kind, (e.g. `FormatKind.Uint8`->`Uint8Array`).
 */
export type Format<
  $Kind extends FormatKind = FormatKind,
  $Binary extends Types.TypedArrayConstructor = Types.TypedArrayConstructor,
> = { kind: $Kind; binary: $Binary }

function makeFormat<
  $Kind extends FormatKind,
  $Binary extends Types.TypedArrayConstructor,
>(kind: $Kind, binary: $Binary): Format<$Kind, $Binary> {
  return {
    [Symbols.$format]: true,
    kind,
    binary,
  } as { kind: $Kind; binary: $Binary }
}

export const float32 = makeFormat(FormatKind.Float32, Float32Array)
export const float64 = makeFormat(FormatKind.Float64, Float64Array)
export const uint8 = makeFormat(FormatKind.Uint8, Uint8Array)
export const uint16 = makeFormat(FormatKind.Uint16, Uint16Array)
export const uint32 = makeFormat(FormatKind.Uint32, Uint32Array)
export const int8 = makeFormat(FormatKind.Int8, Int8Array)
export const int16 = makeFormat(FormatKind.Int16, Int16Array)
export const int32 = makeFormat(FormatKind.Int32, Int32Array)
