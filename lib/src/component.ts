import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Model from "./model"
import * as Type from "./type"
import * as World from "./world"

export type ComponentSet = Archetype.Data<Model.SchemaId>[]
export type ComponentSetInit<$Type extends Type.Type = Type.Type> = {
  [K in keyof $Type]?: Archetype.Row<$Type>[K]
}

export function expressBinaryShape<$Shape extends Model.Shape<Model.BinarySchema>>(
  shape: $Shape,
): Archetype.BinaryData<$Shape> {
  if (Model.isFormat(shape)) {
    return 0 as Archetype.BinaryData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = 0
  }
  return object as Archetype.BinaryData<$Shape>
}

export function expressNativeShape<$Shape extends Model.Shape<Model.NativeSchema>>(
  shape: $Shape,
): Archetype.NativeData<$Shape> {
  if (Model.isFormat(shape)) {
    return 0 as Archetype.NativeData<$Shape>
  }
  const object: { [key: string]: unknown } = {}
  for (const key in shape) {
    object[key] = Model.isFormat(shape)
      ? 0
      : expressNativeShape(shape[key] as unknown as Model.Shape<Model.NativeSchema>)
  }
  return object as Archetype.NativeData<$Shape>
}

export function expressSchema<$Schema extends Model.Schema>(schema: $Schema) {
  return Model.isBinarySchema(schema)
    ? expressBinaryShape(schema.shape)
    : expressNativeShape(schema.shape)
}

export function expressType<$Type extends Type.Type>(
  world: World.World,
  type: $Type,
): Archetype.Row<$Type> {
  return type.map(id =>
    expressSchema(World.findSchemaById(world, id)),
  ) as unknown as Archetype.Row<$Type>
}

export function makeComponentSet(
  world: World.World,
  type: Type.Type,
  data: ComponentSetInit,
): ComponentSet {
  const set: ComponentSet = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    set[id] = data[i] ?? expressSchema(World.findSchemaById(world, id))
  }
  return set
}
