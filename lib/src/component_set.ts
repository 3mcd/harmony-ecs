import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Schema from "./schema"
import * as Type from "./type"
import * as World from "./world"

export type Struct = (Archetype.Data<Schema.Id> | undefined)[]
export type Init<$Signature extends Type.Struct = Type.Struct> = {
  [K in keyof $Signature]?: Archetype.RowData<$Signature>[K]
}

export function make(world: World.Struct, type: Type.Struct, init: Init): Struct {
  const values: Struct = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    values[id] = init[i]
  }
  return values
}
