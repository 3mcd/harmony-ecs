import * as Types from "./types"

/**
 * An entity identifier.
 *
 * Ids may wrap another type. For example, components are represented as
 * `Id<Shape.Struct>`, which allows Harmony to inspect the shape of the
 * component and use it to enforce type-safety in functions like `make` and
 * `add`.
 */
export type Id<$Data = unknown> = number & Types.Opaque<$Data>

/**
 * Extract the wrapped value of an entity identifier.
 */
export type Data<$Id> = $Id extends Id<infer _> ? _ : never

/**
 * Combine the low 32 and high 20 bits of a 52-bit unsigned integer into a
 * single id.
 */
export function pack<$Data>(lo: number, hi: number) {
  return ((hi & 0x3fffff) * 0x40000000 + (lo & 0x3fffffff)) as Id<$Data>
}

/**
 * Read the low 32 bits of a 52-bit unsigned integer.
 */
export function lo(n: number) {
  return n & 0x3fffffff
}

/**
 * Read the high 20 bits of a 52-bit unsigned integer.
 */
export function hi(n: number) {
  return (n - (n & 0x3fffffff)) / 0x40000000
}
