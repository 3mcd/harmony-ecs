const SIZE = 0
const LIMIT = 1
const TARGET = 2
const STALE = 3
const SPARSE_OFFSET = STALE + 1
const DENSE_ENTRY_OFFSET = Uint32Array.BYTES_PER_ELEMENT

/**
 * A data structure that maps positive integer keys to binary values of
 * arbitrary length. Can be shared with other threads.
 */
export type Struct = {
  bytesPerDenseEntry: number
  bytesPerElement: number
  dense: SharedArrayBuffer
  denseView?: DataView
  growFactor: number
  loadFactor: number
  sparse: Uint32Array
}

function calcSlot(k: number, n: number) {
  // Slightly faster than (k % n)
  return n - (k % n)
}

function calcNextGrow(length: number, loadFactor: number) {
  return Math.floor(length * loadFactor)
}

function calcNextLength(length: number, growFactor: number) {
  return Math.ceil(length * growFactor) << 1
}

function grow(set: Struct) {
  // Notify other threads of the stale memory
  set.sparse[STALE] = 1
  // Scale the current length by the grow factor
  let nextLength = calcNextLength(set.sparse[LIMIT], set.growFactor)
  // Create our new memory and views
  let nextSparse = new Uint32Array(
    new SharedArrayBuffer(
      Uint32Array.BYTES_PER_ELEMENT * (SPARSE_OFFSET + nextLength * 2),
    ),
  )
  let nextDense = new SharedArrayBuffer(nextLength * set.bytesPerDenseEntry)
  let nextDenseView = new DataView(nextDense)

  // Copy old values into new dense array
  new Uint8Array(nextDense).set(new Uint8Array(set.dense))

  // Set updated properties
  let size = set.sparse[SIZE]
  nextSparse[SIZE] = size
  nextSparse[LIMIT] = nextLength
  nextSparse[TARGET] = calcNextGrow(nextLength, set.loadFactor)

  // Rehash keys
  for (let i = 0, d = 0; i < size; i++, d += set.bytesPerDenseEntry) {
    let sparseIndex = nextDenseView.getUint32(d)
    let key = set.sparse[sparseIndex]
    let slot = findFreeSlot(nextSparse, key)
    nextSparse[slot] = key
    nextSparse[slot + 1] = d
    nextDenseView.setUint32(d, slot)
  }

  set.dense = nextDense
  set.denseView = nextDenseView
  set.sparse = nextSparse

  return nextLength
}

export function load(prev: Struct, next: Struct) {
  prev.dense = next.dense
  prev.denseView = new DataView(next.dense)
  prev.sparse = next.sparse
}

export function get(set: Struct, key: number): DataView | undefined {
  let limit = set.sparse[LIMIT]
  let offset = calcSlot(key, limit) * 2
  let length = limit * 2

  while (true) {
    let slot = SPARSE_OFFSET + (offset % length)
    if (set.sparse[slot] === key) {
      return new DataView(
        set.dense,
        set.sparse[slot + 1] + DENSE_ENTRY_OFFSET,
        set.bytesPerElement,
      )
    }
    offset += 2
  }
}

export function findFreeSlot(sparse: Uint32Array, key: number) {
  let limit = sparse[LIMIT]
  let offset = calcSlot(key, limit) * 2
  let length = limit * 2

  while (true) {
    let slot = SPARSE_OFFSET + (offset % length)
    let slotKey = sparse[slot]
    if (slotKey === 0) return slot
    if (slotKey === key) return 0
    offset += 2
  }
}

export function add(set: Struct, key: number) {
  let size = set.sparse[SIZE]
  if (size === set.sparse[TARGET]) grow(set)

  let limit = set.sparse[LIMIT]
  let offset = calcSlot(key, limit) * 2
  let length = limit * 2

  while (true) {
    let slot = SPARSE_OFFSET + (offset % length)
    let slotKey = set.sparse[slot]
    let denseIndex: number
    if (slotKey === 0) {
      denseIndex = size * set.bytesPerDenseEntry
      set.sparse[slot] = key
      set.sparse[slot + 1] = denseIndex
      set.sparse[SIZE]++
      set.denseView!.setUint32(denseIndex, slot)
    } else if (slotKey === key) {
      denseIndex = set.sparse[slot + 1]
    } else {
      offset += 2
      continue
    }
    return new DataView(set.dense, denseIndex + DENSE_ENTRY_OFFSET, set.bytesPerElement)
  }
}

export function make(
  length: number,
  bytesPerElement: number,
  growFactor = 2,
  loadFactor = 0.7,
): Struct {
  let bytesPerDenseEntry = DENSE_ENTRY_OFFSET + bytesPerElement
  let sparse = new Uint32Array(
    new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * (SPARSE_OFFSET + length * 2)),
  )
  let dense = new SharedArrayBuffer(length * bytesPerDenseEntry)
  sparse[TARGET] = calcNextGrow(length, loadFactor)
  sparse[LIMIT] = length
  return {
    bytesPerDenseEntry,
    bytesPerElement,
    dense,
    denseView: new DataView(dense),
    sparse,
    growFactor,
    loadFactor,
  }
}

export function entries(set: Struct) {}

export function forEach(set: Struct) {}

export function size(set: Struct) {
  return set.sparse[SIZE]
}
