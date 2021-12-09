/**
 * A hashmap-esque data structure for storing and checking for the existence
 * of type hashes. Hashes can't be removed, only added.
 */
export type Struct = { array: Float64Array; loadFactor: number }

const VALUE_OFFSET = 1

/**
 * Double the size of the `TableCheck`'s underlying `ArrayBuffer`
 */
function double(tableCheck: Struct) {
  let prevArray = tableCheck.array
  let prevLength = prevArray.length - VALUE_OFFSET
  let nextLength = prevLength * 2
  let nextArray = new Float64Array(VALUE_OFFSET + nextLength)

  nextArray[0] = prevArray[0]

  for (let i = VALUE_OFFSET; i < prevArray.length; i++) {
    let hash = prevArray[i]
    if (hash === 0) continue
    insert(nextArray, prevLength, hash)
  }

  tableCheck.array = nextArray
}

function insert(array: Float64Array, length: number, hash: number) {
  let start = VALUE_OFFSET + (hash % length)

  for (let i = 0; i < length; i++) {
    let index = (start + i) % (length + VALUE_OFFSET)
    let value = array[index]
    if (value === 0) {
      array[index] = hash
      return
    }
    if (value === hash) {
      console.warn("Failed to insert hash: collision occurred")
      return
    }
  }
}

/**
 * Add a hash to the `TableCheck`.
 */
export function add(tableCheck: Struct, hash: number) {
  if (hash < 1) throw new RangeError("Failed to add hash: must be a value greater than 1")

  let array = tableCheck.array
  let length = array.length - VALUE_OFFSET

  if (array[0] >= Math.ceil(length * tableCheck.loadFactor)) {
    double(tableCheck)
    add(tableCheck, hash)
  } else {
    insert(array, length, hash)
    array[0]++
  }
}

/**
 * Check for the existence of a hash in the `TableCheck`.
 */
export function has(tableCheck: Struct, hash: number) {
  if (hash < 1) return false

  let array = tableCheck.array
  let length = array.length - VALUE_OFFSET
  let start = VALUE_OFFSET + (hash % length)

  for (let i = 0; i < length; i++) {
    let index = (start + i) % (length + VALUE_OFFSET)
    if (array[index] === hash) return true
  }

  return false
}

/**
 * Create a `TableCheck`.
 */
export function make(size: number, loadFactor = 0.8): Struct {
  return {
    array: new Float64Array(
      new SharedArrayBuffer((VALUE_OFFSET + size) * Float64Array.BYTES_PER_ELEMENT),
    ),
    loadFactor,
  }
}

export function size(tableCheck: Struct) {
  return tableCheck.array[0]
}
