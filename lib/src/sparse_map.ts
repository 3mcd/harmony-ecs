/**
 * A callback function passed to `SparseMap.forEach`
 */
export type SparseMapIteratee<$Value, $Key extends number> = (
  value: $Value,
  key: $Key,
) => void

/**
 * A map that references values using unsigned integers. Uses a packed array in
 * conjunction with a key-value index for fast lookup, add/remove operations,
 * and iteration. SparseMap is used frequently in Harmony since entities
 * (including schema and game objects) are represented as unsigned integers.
 *
 * SparseMap is faster than ES Maps in all cases. It is slower than sparse
 * arrays for read/write operations, but faster to iterate.
 */
export type Struct<$Value = unknown, $Key extends number = number> = {
  /** @readonly */
  size: number
  /** @internal */
  keys: $Key[]
  /** @internal */
  values: $Value[]
  /** @internal */
  index: Record<$Key, number | undefined>
}

/**
 * Create a SparseMap.
 */
export function make<$Value, $Key extends number = number>(
  init: ($Value | undefined)[] = [],
): Struct<$Value, $Key> {
  let size = 0
  const index: (number | undefined)[] = []
  const keys: $Key[] = []
  const values: $Value[] = []
  for (let i = 0; i < init.length; i++) {
    const value = init[i]
    if (value !== undefined) {
      keys.push(i as $Key)
      values[i] = value
      index[i] = size
      size++
    }
  }
  return {
    size,
    keys,
    values,
    index,
  }
}

/**
 * Retrieve the value for a given key from a SparseMap. Returns `undefined` if
 * no record exists for the given key.
 */
export function get<$Value, $Key extends number>(
  map: Struct<$Value, $Key>,
  key: $Key,
): $Value | undefined {
  return map.values[key]
}

/**
 * Add or update the value of an entry with the given key within a SparseMap.
 */
export function set<$Value, $Key extends number>(
  map: Struct<$Value, $Key>,
  key: $Key,
  value: $Value,
) {
  if (!has(map, key)) {
    map.index[key] = map.keys.push(key) - 1
    map.size++
  }
  map.values[key] = value
}

/**
 * Remove an entry by key from a SparseMap.
 */
export function remove<$Key extends number>(map: Struct<unknown, $Key>, key: $Key) {
  const i = map.index[key]
  if (i === undefined) return
  const k = map.keys.pop()
  const h = --map.size
  map.index[key] = map.values[key] = undefined
  if (h !== i) {
    map.keys[i!] = k!
    map.index[k!] = i
  }
}

/**
 * Check for the existence of a value by key within a SparseMap. Returns true
 * if the SparseMap contains an entry for the provided key.
 */
export function has(map: Struct, key: number) {
  return map.index[key] !== undefined
}

/**
 * Clear all entries from a SparseMap.
 */
export function clear(map: Struct) {
  map.keys.length = 0
  map.values.length = 0
  ;(map.index as number[]).length = 0
  map.size = 0
}

/**
 * Iterate a SparseMap using a iteratee function.
 */
export function forEach<$Value, $Key extends number>(
  map: Struct<$Value, $Key>,
  iteratee: SparseMapIteratee<$Value, $Key>,
) {
  for (let i = 0; i < map.size; i++) {
    const k = map.keys[i]!
    const d = map.values[k]!
    iteratee(d, k)
  }
}
