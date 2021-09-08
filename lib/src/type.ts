import { SchemaId } from "./schema"

export type Type = ReadonlyArray<SchemaId>

export function addToType(type: Type, add: SchemaId): Type {
  const next: number[] = []
  let added = false
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e >= add && !added) {
      if (e !== add) {
        next.push(add)
      }
      added = true
    }
    next.push(e)
  }
  if (!added) {
    next.push(add)
  }
  return next as unknown as Type
}

export function removeFromType(type: Type, remove: SchemaId): Type {
  const next: number[] = []
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e !== remove) {
      next.push(e)
    }
  }
  return next as unknown as Type
}

export function normalizeType(type: Type) {
  return Object.freeze(type.slice().sort((a, b) => a - b))
}

export function invariantTypeNormalized(type: Type) {
  for (let i = 0; i < type.length - 1; i++) {
    if (type[i] > type[i + 1]) {
      throw new TypeError("abnormal type")
    }
  }
}

export function isSupersetOf(type: Type, subset: Type) {
  let i = 0
  let j = 0
  if (type.length < subset.length) {
    return false
  }
  while (i < type.length && j < subset.length) {
    const typeId = type[i]
    const subsetTypeId = subset[j]
    if (typeId < subsetTypeId) {
      i++
    } else if (typeId === subsetTypeId) {
      i++
      j++
    } else {
      return false
    }
  }
  return j === subset.length
}

export function makeTypeHash(type: Type) {
  let buckets = 97
  let hash = type.length % buckets
  for (let i = 0; i < type.length; i++) {
    hash = (hash + type[i]) % buckets
  }
  return hash
}
