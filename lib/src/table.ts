import * as Entity from "./entity"
import * as Type from "./type"

/**
 * A densely packed vector of entity data.
 */
export type Column = unknown[]

/**
 * A table of entity data for entities of a specific type.
 */
export type Struct = {
  type: Type.Struct
  columns: Column[]
}

export function make(type: Type.Struct): Struct {
  return {
    type,
    columns: [],
  }
}

export function insert(table: Struct, type: Type.Struct, data: unknown) {
  return 999
}
