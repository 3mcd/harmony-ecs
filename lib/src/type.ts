import * as Debug from "./debug"
import * as Entity from "./entity"

/**
 * A type signature that characterizes an entity.
 */
export type Struct = ReadonlyArray<Entity.Id>

// prettier-ignore
// Taken from https://github.com/tjwebb/fnv-plus
function fast1a52(arr: ReadonlyArray<number>) {
  let i,l=arr.length-3,t0=0,v0=0x2325,t1=0,v1=0x8422,t2=0,v2=0x9ce4,t3=0,v3=0xcbf2;

  for (i = 0; i < l;) {
    v0^=arr[i++];
    t0=v0*435;t1=v1*435;t2=v2*435;t3=v3*435;
    t2+=v0<<8;t3+=v1<<8;
    t1+=t0>>>16;v0=t0&65535;t2+=t1>>>16;v1=t1&65535;v3=(t3+(t2>>>16))&65535;v2=t2&65535;
    v0^=arr[i++];
    t0=v0*435;t1=v1*435;t2=v2*435;t3=v3*435;
    t2+=v0<<8;t3+=v1<<8;
    t1+=t0>>>16;v0=t0&65535;t2+=t1>>>16;v1=t1&65535;v3=(t3+(t2>>>16))&65535;v2=t2&65535;
    v0^=arr[i++];
    t0=v0*435;t1=v1*435;t2=v2*435;t3=v3*435;
    t2+=v0<<8;t3+=v1<<8;
    t1+=t0>>>16;v0=t0&65535;t2+=t1>>>16;v1=t1&65535;v3=(t3+(t2>>>16))&65535;v2=t2&65535;
    v0^=arr[i++];
    t0=v0*435;t1=v1*435;t2=v2*435;t3=v3*435;
    t2+=v0<<8;t3+=v1<<8;
    t1+=t0>>>16;v0=t0&65535;t2+=t1>>>16;v1=t1&65535;v3=(t3+(t2>>>16))&65535;v2=t2&65535;
  }

  while(i<l+3){
    v0^=arr[i++];
    t0=v0*435;t1=v1*435;t2=v2*435;t3=v3*435;
    t2+=v0<<8;t3+=v1<<8;
    t1+=t0>>>16;v0=t0&65535;t2+=t1>>>16;v1=t1&65535;v3=(t3+(t2>>>16))&65535;v2=t2&65535;
  }

  return (v3 & 15) * 281474976710656 + v2 * 4294967296 + v1 * 65536 + (v0 ^ (v3 >> 4))
}

export function hash(type: Struct) {
  return fast1a52(type)
}

export function invariantNormalized(type: Struct) {
  for (let i = 0; i < type.length - 1; i++) {
    const a = type[i]
    const b = type[i + 1]
    Debug.invariant(a !== undefined)
    Debug.invariant(b !== undefined)
    if (a > b) {
      throw new TypeError("abnormal type")
    }
  }
}

export function add(type: Struct, add: Entity.Id): Struct {
  invariantNormalized(type)
  const next: number[] = []
  let added = false
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    if (id >= add && !added) {
      if (id !== add) next.push(add)
      added = true
    }
    next.push(id)
  }
  if (!added) next.push(add)
  return next as unknown as Struct
}

export function and(a: Struct, b: Struct): Struct {
  invariantNormalized(a)
  let next = a.slice() as Struct
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    Debug.invariant(id !== undefined)
    next = add(next, id)
  }
  return next
}

export function xor(a: Struct, b: Struct): Struct {
  invariantNormalized(a)
  let next = a.slice() as Struct
  for (let i = 0; i < b.length; i++) {
    const id = b[i]
    Debug.invariant(id !== undefined)
    next = remove(next, id)
  }
  return next
}

export function remove(type: Struct, remove: Entity.Id): Struct {
  invariantNormalized(type)
  const next: number[] = []
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e !== remove) {
      Debug.invariant(e !== undefined)
      next.push(e)
    }
  }
  return next as unknown as Struct
}

export function normalize(type: Struct) {
  return type.slice().sort((a, b) => a - b)
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

export function contains(outer: Struct, inner: Struct) {
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
    Debug.invariant(outerId !== undefined)
    Debug.invariant(innerId !== undefined)
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

export function couldContain(outer: Struct, inner: Struct) {
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
    Debug.invariant(outerId !== undefined)
    Debug.invariant(innerId !== undefined)
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

export function invariantContains(outer: Struct, inner: Struct) {
  if (!contains(outer, inner)) {
    throw new RangeError("type is not superset")
  }
}

export function diff(right: Struct, left: Struct) {
  invariantContains(right, left)
  let o = 0
  let i = 0
  const path: Entity.Id[] = []
  if (right.length - left.length === 1) {
    let j = 0
    let length = right.length
    for (; j < length && right[j] === left[j]; j++) {}
    const t = right[j]
    Debug.invariant(t !== undefined)
    path.push(t)
    return path
  }
  while (o < right.length - 1) {
    const outerId = right[o]
    const innerId = left[i]
    Debug.invariant(outerId !== undefined)
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
