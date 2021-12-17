import * as Types from "./types"

/**
 * A dead simple integer->number map that can be shared between worker threads.
 * Similar to a HashMap in that the keys should ideally be evenly distributed.
 *
 * Keys must be nonzero integers because `0` is used to identify empty slots in
 * the map.
 *
 * `SharedUintMap` automatically grows when the ratio of used to available
 * storage exceeds the configured `loadFactor`.
 */
export type Struct = {
  /**
   * A percentage (0-1) that defines the threshold at which `SharedUintMap`
   * will double its storage.
   */
  loadFactor: number

  /**
   * A TypedArray that holds keys added to the `SharedUintMap`.
   */
  keys: Types.TypedArray

  /**
   * An integer that identifies the number format for keys stored in the
   * `SharedUintMap`.
   */
  keysTypedArrayId: Types.TypedArrayId

  /**
   * A TypedArray that holds values added to the `SharedUintMap`.
   */
  values: Types.TypedArray

  /**
   * An integer that identifies the number format for values stored in the
   * `SharedUintMap`.
   */
  valuesTypedArrayId: Types.TypedArrayId
}

const START_OFFSET = 1

/**
 * Double the size of the `SharedUintMap`'s underlying `ArrayBuffer`
 */
function double(map: Struct) {
  let KeyArrayCtor = Types.TYPED_ARRAY_CTOR_LOOKUP.get(map.valuesTypedArrayId)!
  let k1 = map.keys
  let k2 = new KeyArrayCtor(
    new SharedArrayBuffer(
      (START_OFFSET + (k1.length - START_OFFSET) * 2) * KeyArrayCtor.BYTES_PER_ELEMENT,
    ),
  )
  let ValueArrayCtor = Types.TYPED_ARRAY_CTOR_LOOKUP.get(map.keysTypedArrayId)!
  let v1 = map.values
  let v2 = new ValueArrayCtor(
    new SharedArrayBuffer(
      (START_OFFSET + (k1.length - START_OFFSET) * 2) * ValueArrayCtor.BYTES_PER_ELEMENT,
    ),
  )

  k2[0] = k1[0]

  for (let i = START_OFFSET; i < k1.length; i++) {
    let k = k1[i]
    if (k === 0) continue
    let v = v1[i]
    insert(k2, v2, k, v)
  }

  map.keys = k2
  map.values = v2
}

function findIndex(keys: Types.TypedArray, k: number) {
  let length = keys.length - START_OFFSET
  let start = k % length

  for (let i = START_OFFSET; i < length; i++) {
    let index = (start + i) % length
    let key = keys[index]
    if (key === k) return index
  }

  return 0
}

function findFreeIndex(keys: Types.TypedArray, k: number) {
  let length = keys.length - START_OFFSET
  let start = k % length

  for (let i = START_OFFSET; i < length; i++) {
    let index = (start + i) % length
    let value = keys[index]
    if (value === 0) return index
    if (value === k) return 0
  }

  return 0
}

function insert(keys: Types.TypedArray, values: Types.TypedArray, k: number, v: number) {
  let i = findFreeIndex(keys, k)
  if (i > 0) {
    keys[i] = k
    values[i] = v
  }
}

/**
 * Add an entry to the `SharedUintMap`.
 */
export function set(map: Struct, k: number, v = 0) {
  if (k === 0) {
    throw new RangeError("Failed to update entry: key must not be zero")
  }
  if (map.keys[0] >= Math.ceil((map.keys.length - START_OFFSET) * map.loadFactor)) {
    double(map)
  }
  insert(map.keys, map.values, k, v)
  map.keys[0]++
  return v
}

/**
 * Remove an entry from `SharedUintMap`.
 */
export function remove(map: Struct, k: number) {
  let i = findIndex(map.keys, k)
  if (i > 0) {
    map.keys[i] = 0
    map.keys[0]--
  }
}

/**
 * Get the value of an entry in the `SharedUintMap`.
 */
export function get(map: Struct, k: number) {
  if (k === 0) {
    throw new RangeError("Failed to get entry: key must not be zero")
  }
  let index = findIndex(map.keys, k)
  if (index > 0) {
    return map.values[index]
  }
  return null
}

/**
 * Check for the existence of an entry in the `SharedUintMap`.
 */
export function has(map: Struct, k: number) {
  if (k === 0) {
    throw new RangeError("Failed to get entry: key must not be zero")
  }
  return findIndex(map.keys, k) > 0
}

/**
 * Create a `SharedUintMap`.
 */
export function make(
  size: number,
  loadFactor = 0.8,
  keyType: Types.TypedArrayConstructor = Float64Array,
  valueType: Types.TypedArrayConstructor = Float64Array,
): Struct {
  const keysTypedArrayId = Types.TYPED_ARRAY_ID_LOOKUP.get(keyType)!
  const keys = new keyType(
    new SharedArrayBuffer((START_OFFSET + size) * keyType.BYTES_PER_ELEMENT),
  )
  const valuesTypedArrayId = Types.TYPED_ARRAY_ID_LOOKUP.get(valueType)!
  const values = new valueType(
    new SharedArrayBuffer((START_OFFSET + size) * valueType.BYTES_PER_ELEMENT),
  )
  return {
    keys,
    keysTypedArrayId,
    loadFactor,
    values,
    valuesTypedArrayId,
  }
}

export function size(map: Struct) {
  return map.keys[0]
}
