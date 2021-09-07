import { Type } from "./archetype";
import { SchemaId } from "./schema";

export function addToType(type: Type, add: SchemaId): Type {
  const next: number[] = []
  let added = false
  let el = 0
  for (let i = 0; i < type.length; i++) {
    const e = type[i]
    if (e >= add && !added) {
      if (e !== add) {
        next[el++] = add
      }
      added = true
    }
    next[el++] = e
  }
  if (!added) {
      next[el++] = add
  }
  return next as unknown as Type
}