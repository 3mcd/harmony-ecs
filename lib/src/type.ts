import { invariant } from "./debug"
import { SchemaId } from "./model"

export type Type = ReadonlyArray<SchemaId>

export function add(type: Type, add: SchemaId): Type {
  invariantNormalized(type)
  const next: number[] = []
  let added = false
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    if (id >= add && !added) {
      if (id !== add) {
        next.push(add)
      }
      added = true
    }
    next.push(id)
  }
  if (!added) {
    next.push(add)
  }
  return next as unknown as Type
}

export function and(a: Type, b: Type): Type {
  invariantNormalized(a)
  let next = a.slice() as Type
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    invariant(id !== undefined)
    next = add(next, id)
  }
  return next
}

export function xor(a: Type, b: Type): Type {
  invariantNormalized(a)
  let next = a.slice() as Type
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    invariant(id !== undefined)
    next = remove(next, id)
  }
  return next
}

export function remove(type: Type, remove: SchemaId): Type {
  invariantNormalized(type)
  const next: number[] = []
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e !== remove) {
      invariant(e !== undefined)
      next.push(e)
    }
  }
  return next as unknown as Type
}

export function normalize(type: Type) {
  return Object.freeze(type.slice().sort((a, b) => a - b))
}

export function invariantNormalized(type: Type) {
  for (let i = 0; i < type.length - 1; i++) {
    const a = type[i]
    const b = type[i + 1]
    invariant(a !== undefined)
    invariant(b !== undefined)
    if (a > b) {
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
  invariantNormalized(outer)
  invariantNormalized(inner)
  let o = 0
  let i = 0
  if (outer.length <= inner.length) {
    return false
  }
  while (o < outer.length && i < inner.length) {
    const outerId = outer[o]
    const innerId = inner[i]
    invariant(outerId !== undefined)
    invariant(innerId !== undefined)
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
  invariantNormalized(outer)
  invariantNormalized(inner)
  let o = 0
  let i = 0
  if (outer.length === 0) {
    return true
  }
  while (o < outer.length && i < inner.length) {
    const outerId = outer[o]
    const innerId = inner[i]
    invariant(outerId !== undefined)
    invariant(innerId !== undefined)
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

export function getIdsBetween(right: Type, left: Type) {
  invariantIsSupersetOf(right, left)
  let o = 0
  let i = 0
  const path: SchemaId[] = []
  if (right.length - left.length === 1) {
    let j = 0
    let length = right.length
    for (; j < length && right[j] === left[j]; j++) {}
    const t = right[j]
    invariant(t !== undefined)
    path.push(t)
    return path
  }
  while (o < right.length - 1) {
    const outerId = right[o]
    const innerId = left[i]
    invariant(outerId !== undefined)
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
