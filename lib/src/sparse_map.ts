const $data = Symbol("h_smap_data")
const $keys = Symbol("h_smap_keys")
const $index = Symbol("h_smap_index")

export type SparseMap<$Value = unknown, $Key extends number = number> = {
  readonly size: number
  [$keys]: $Key[]
  [$data]: $Value[]
  [$index]: Record<$Key, number | undefined>
}

type MutSparseMap = { size: number }

export function make<$Value, $Key extends number = number>(
  init: ($Value | undefined)[] = [],
): SparseMap<$Value, $Key> {
  let size = 0
  const index: (number | undefined)[] = []
  const keys: $Key[] = []
  const data: $Value[] = []
  for (let i = 0; i < init.length; i++) {
    const value = init[i]
    if (value !== undefined) {
      keys.push(i as $Key)
      data[i] = value
      index[i] = size
      size++
    }
  }
  return {
    size,
    [$keys]: keys,
    [$data]: data,
    [$index]: index,
  }
}

export function get<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  key: $Key,
) {
  return map[$data][key]
}

export function set<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  key: $Key,
  value: $Value,
) {
  if (!has(map, key)) {
    map[$index][key] = map[$keys].push(key) - 1
    ;(map as MutSparseMap).size++
  }
  map[$data][key] = value
}

export function remove<$Key extends number>(map: SparseMap<unknown, $Key>, key: $Key) {
  const i = map[$index][key]
  if (i === undefined) {
    return
  }
  const k = map[$keys].pop()
  const h = --(map as MutSparseMap).size
  map[$index][key] = map[$data][key] = undefined
  if (h !== i) {
    map[$keys][i!] = k!
    map[$index][k!] = i
  }
}

export function has(map: SparseMap, key: number) {
  return map[$index][key] !== undefined
}

export function clear(map: SparseMap) {
  map[$keys].length = 0
  map[$data].length = 0
  ;(map[$index] as number[]).length = 0
  ;(map as MutSparseMap).size = 0
}

export function forEach<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  iteratee: (value: $Value, key: $Key) => unknown,
) {
  for (let i = 0; i < (map as MutSparseMap).size; i++) {
    const k = map[$keys][i]!
    const d = map[$data][k]!
    iteratee(d, k)
  }
}
