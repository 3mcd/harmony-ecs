import { SchemaId } from "./schema"

export type Type = ReadonlyArray<SchemaId>

export function addToType(type: Type, add: SchemaId): Type {
  invariantTypeNormalized(type)
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
  invariantTypeNormalized(type)
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

export function isEqual(outer: Type, inner: Type) {
  if (outer.length !== inner.length) {
    return false
  }
  for (let i = 0; i < outer.length; i++) {
    if (outer[i] !== inner[i]) return false
  }
  return true
}

export function isSupersetOf(outer: Type, inner: Type) {
  invariantTypeNormalized(outer)
  invariantTypeNormalized(inner)
  let o = 0
  let i = 0
  if (outer.length <= inner.length) {
    return false
  }
  while (o < outer.length && i < inner.length) {
    const outerId = outer[o]
    const innerId = inner[i]
    if (outerId < innerId) {
      o++
    } else if (outerId === innerId) {
      o++
      i++
    } else {
      return false
    }
  }
  return i === inner.length
}

export function invariantIsSupersetOf(outer: Type, inner: Type) {
  if (!isSupersetOf(outer, inner)) {
    throw new RangeError("type is not superset")
  }
}

export function maybeSupersetOf(outer: Type, inner: Type) {
  invariantTypeNormalized(outer)
  invariantTypeNormalized(inner)
  let o = 0
  let i = 0
  if (outer.length === 0) {
    return true
  }
  while (o < outer.length && i < inner.length) {
    const outerId = outer[o]
    const innerId = inner[i]
    if (outerId < innerId) {
      o++
    } else if (outerId === innerId) {
      o++
      i++
    } else {
      return false
    }
  }
  return true
}

export function getIdsBetween(outer: Type, inner: Type) {
  invariantIsSupersetOf(outer, inner)
  let o = 0
  let i = 0
  const path: SchemaId[] = []
  if (outer.length - inner.length === 1) {
    let j = 0
    let length = outer.length
    for (; j < length && outer[j] === inner[j]; j++) {}
    path.push(outer[j])
    return path
  }
  while (o < outer.length - 1) {
    const outerId = outer[o]
    const innerId = inner[i]
    if (innerId === undefined || outerId < innerId) {
      path.push(outerId)
      o++
    } else if (outerId === innerId) {
      o++
      i++
    }
  }
  return path
}
