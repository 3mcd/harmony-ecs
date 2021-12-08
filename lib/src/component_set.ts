import * as Table from "./table"
import * as Debug from "./debug"
import * as Schema from "./schema"
import * as Type from "./type"

export type Struct = (Schema.Express<Schema.Struct> | null | undefined)[]
export type Init<$Type extends Type.Struct = Type.Struct> = {
  [K in keyof $Type]?: Table.Row<$Type>[K]
}

export function make(type: Type.Struct, init: Init): Struct {
  const values: Struct = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    values[id] = init[i]
  }
  return values
}
