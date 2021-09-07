import { Type } from "./archetype"
import { SchemaId } from "./schema"

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
