import { invariant } from "./debug"
import { Id } from "./schema"

/**
 * An array of schema ids that fully defines the component makeup of an entity.
 */
export type Struct = ReadonlyArray<Id>

export function add(type: Struct, add: Id): Struct {
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
  return next as unknown as Struct
}

export function and(a: Struct, b: Struct): Struct {
  invariantNormalized(a)
  let next = a.slice() as Struct
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    invariant(id !== undefined)
    next = add(next, id)
  }
  return next
}

export function xor(a: Struct, b: Struct): Struct {
  invariantNormalized(a)
  let next = a.slice() as Struct
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    invariant(id !== undefined)
    next = remove(next, id)
  }
  return next
}

export function remove(type: Struct, remove: Id): Struct {
  invariantNormalized(type)
  const next: number[] = []
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e !== remove) {
      invariant(e !== undefined)
      next.push(e)
    }
  }
  return next as unknown as Struct
}

export function normalize(type: Struct) {
  return Object.freeze(type.slice().sort((a, b) => a - b))
}

export function invariantNormalized(type: Struct) {
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

export function isEqual(outer: Struct, inner: Struct) {
  if (outer.length !== inner.length) {
    return false
  }
  for (let i = 0; i < outer.length; i++) {
    if (outer[i] !== inner[i]) return false
  }
  return true
}

export function isSupersetOf(outer: Struct, inner: Struct) {
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

export function invariantIsSupersetOf(outer: Struct, inner: Struct) {
  if (!isSupersetOf(outer, inner)) {
    throw new RangeError("type is not superset")
  }
}

export function maybeSupersetOf(outer: Struct, inner: Struct) {
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

export function getIdsBetween(right: Struct, left: Struct) {
  invariantIsSupersetOf(right, left)
  let o = 0
  let i = 0
  const path: Id[] = []
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
