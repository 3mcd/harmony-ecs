import { AnySchema } from "./schema"

let nextSchemaId = 0
export const internalReservedSchemaIds = new Set<number>()
export const internalSchemaIndex = new Map<AnySchema, number>()
export function internalReserveSchemaId(id?: number) {
  if (typeof id === "number") {
    if (internalReservedSchemaIds.has(id)) {
      throw new RangeError(`schema id ${id} is already designated`)
    }
  } else {
    while (internalReservedSchemaIds.has(nextSchemaId)) {
      nextSchemaId++
    }
    id = nextSchemaId
  }
  internalReservedSchemaIds.add(id)
  return id
}

// symbols
export const internal$harmonyFormat = Symbol("harmony_schema_kind")
