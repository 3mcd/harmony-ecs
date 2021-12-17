export type Struct = {
  bytesPerElement: number
  data: ArrayBufferLike
  growFactor: number
  keys: Uint32Array
  loadFactor: number
  nextGrowLength: number
  view: DataView
}

const STALE = 1
const BYTES_PER_KEY = Uint32Array.BYTES_PER_ELEMENT
const START_OFFSET = 3

const KEYS_SIZE = 0
const KEYS_LENGTH = 1
const KEYS_IS_STALE = 2
// 0: size, 1: length - BYTES_PER_ELEMENT, 2: stale

function roundToNearestN(x: number, n: number) {
  return Math.ceil(x / n) * n
}

function calcNextGrowLength(size: number, loadFactor: number) {
  return roundToNearestN(size + size * loadFactor, BYTES_PER_KEY)
}

function load(
  set: Struct,
  keys: Uint32Array,
  data: ArrayBufferLike,
  view: DataView = new DataView(data),
) {
  set.keys = keys
  set.data = data
  set.view = view
  set.nextGrowLength = calcNextGrowLength(set.keys[KEYS_LENGTH], set.loadFactor)
}

function grow(set: Struct) {
  let { keys, data, view, growFactor, bytesPerElement } = set
  let length = keys[1]
  let nextKeys = new Uint32Array(
    new SharedArrayBuffer(
      roundToNearestN(
        (START_OFFSET + Math.max(length * growFactor, 1)) * BYTES_PER_KEY,
        BYTES_PER_KEY,
      ),
    ),
  )
  let nextData = new SharedArrayBuffer(
    roundToNearestN(data.byteLength * growFactor * bytesPerElement, bytesPerElement),
  )
  let nextView = new DataView(nextData)

  let i = 0
  for (; i < START_OFFSET; i++) {
    nextKeys[i] = keys[i]
  }
  for (; i < keys.length; i++) {
    let k = keys[i]
    if (k === 0) continue
    let prevOffset = i * bytesPerElement
    let nextOffset = insertKey(nextKeys, k)
    for (let j = 0; j < bytesPerElement; j++) {
      nextView.setUint8(nextOffset + j, view.getUint8(prevOffset + j))
    }
  }

  keys[KEYS_IS_STALE] = STALE

  load(set, nextKeys, nextData, nextView)
}

function findIndex(keys: Uint32Array, key: number) {
  let size = keys[0]
  let start = key % size

  for (let i = START_OFFSET; i < size; i++) {
    let index = (start + i) % size
    let k = keys[index]
    if (k === key) return index
  }

  return 0
}

function findFreeIndex(keys: Uint32Array, key: number) {
  let size = keys[0]
  let start = key % size

  for (let i = START_OFFSET; i < size; i++) {
    let index = (start + i) % size
    let k = keys[index]
    if (k === 0) return index
    if (k === key) return 0
  }

  return 0
}

function insertKey(keys: Uint32Array, key: number) {
  let index = findFreeIndex(keys, key)
  if (index > 0) {
    keys[index] = key
    keys[0]++
  }
  return index
}

export function add(set: Struct, key: number) {
  if (key === 0) {
    throw new RangeError("Failed to update entry: key must not be zero")
  }
  let { keys, bytesPerElement, nextGrowLength } = set
  if (keys[0] >= nextGrowLength) {
    grow(set)
  }
  let index = insertKey(keys, key)
  return index * bytesPerElement
}

export function findOffset(set: Struct, key: number) {
  let index = findIndex(set.keys, key)
  if (index === 0) {
    throw new RangeError()
  }
  return index * set.bytesPerElement
}

export function getSize(set: Struct) {
  return set.keys[0]
}

export function getVersion(set: Struct) {
  return set.keys[1]
}

export function make(
  size = 0,
  bytesPerElement = 4,
  loadFactor = 0.7,
  growFactor = loadFactor,
): Struct {
  let keysByteLength = (START_OFFSET + size) * BYTES_PER_KEY
  let keys = new Uint32Array(new SharedArrayBuffer(keysByteLength))
  let data = new SharedArrayBuffer(size * bytesPerElement)
  let view = new DataView(data)
  return {
    bytesPerElement,
    data,
    growFactor,
    keys,
    loadFactor,
    nextGrowLength: calcNextGrowLength(size, loadFactor),
    view,
  }
}
