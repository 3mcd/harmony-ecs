export type SparseMap<$Value = unknown, $Key extends number = number> = {
  size: number
  keys: $Key[]
  values: $Value[]
  index: Record<$Key, number | undefined>
}

export function make<$Value, $Key extends number = number>(
  init: ($Value | undefined)[] = [],
): SparseMap<$Value, $Key> {
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

export function get<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  key: $Key,
) {
  return map.values[key]
}

export function set<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  key: $Key,
  value: $Value,
) {
  if (!has(map, key)) {
    map.index[key] = map.keys.push(key) - 1
    map.size++
  }
  map.values[key] = value
}

export function remove<$Key extends number>(map: SparseMap<unknown, $Key>, key: $Key) {
  const i = map.index[key]
  if (i === undefined) return
  const k = map.keys.pop()
  const h = -map.size
  map.index[key] = map.values[key] = undefined
  if (h !== i) {
    map.keys[i!] = k!
    map.index[k!] = i
  }
}

export function has(map: SparseMap, key: number) {
  return map.index[key] !== undefined
}

export function clear(map: SparseMap) {
  map.keys.length = 0
  map.values.length = 0
  ;(map.index as number[]).length = 0
  map.size = 0
}

export function forEach<$Value, $Key extends number>(
  map: SparseMap<$Value, $Key>,
  iteratee: (value: $Value, key: $Key) => unknown,
) {
  for (let i = 0; i < map.size; i++) {
    const k = map.keys[i]!
    const d = map.values[k]!
    iteratee(d, k)
  }
}
