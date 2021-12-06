import * as Component from "./component"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Type from "./type"
import * as Types from "./types"
import * as World from "./world"
import * as ComponentSet from "./component_set"

export type BinaryData<$Shape extends Schema.Shape<Schema.AnyBinarySchema>> =
  $Shape extends Format.Struct ? number : { [K in keyof $Shape]: number }

export type NativeData<$Shape extends Schema.Shape<Schema.AnyNativeSchema>> =
  $Shape extends Format.Struct
    ? number
    : {
        [K in keyof $Shape]: $Shape[K] extends Format.Struct
          ? number
          : $Shape[K] extends Schema.Shape<Schema.AnyNativeSchema>
          ? NativeData<$Shape[K]>
          : never
      }

export type DataOfShape<$Shape extends Schema.Shape<Schema.ComplexSchema>> =
  $Shape extends Schema.Shape<Schema.AnyBinarySchema>
    ? BinaryData<$Shape>
    : $Shape extends Schema.Shape<Schema.AnyNativeSchema>
    ? NativeData<$Shape>
    : never

export type Data<$SchemaId extends Schema.Id> = $SchemaId extends Schema.Id<infer $Schema>
  ? $Schema extends Schema.ComplexSchema
    ? DataOfShape<Schema.Shape<$Schema>>
    : never
  : never

type ScalarBinaryColumn<
  $Schema extends Schema.BinaryScalarSchema = Schema.BinaryScalarSchema,
> = {
  kind: Schema.SchemaKind.BinaryScalar
  schema: $Schema
  data: Types.Construct<Schema.Shape<$Schema>["binary"]>
}

type ComplexBinaryColumn<
  $Schema extends Schema.BinaryStructSchema = Schema.BinaryStructSchema,
> = {
  kind: Schema.SchemaKind.BinaryStruct
  schema: $Schema
  data: {
    [K in keyof Schema.Shape<$Schema>]: Types.Construct<
      Schema.Shape<$Schema>[K]["binary"]
    >
  }
}

type ScalarNativeColumn<
  $Schema extends Schema.NativeScalarSchema = Schema.NativeScalarSchema,
> = {
  kind: Schema.SchemaKind.NativeScalar
  schema: $Schema
  data: number[]
}

type ComplexNativeColumn<
  $Schema extends Schema.NativeObjectSchema = Schema.NativeObjectSchema,
> = {
  kind: Schema.SchemaKind.NativeObject
  schema: $Schema
  data: NativeData<Schema.Shape<$Schema>>[]
}

type TagColumn<$Schema extends Schema.TagSchema = Schema.TagSchema> = {
  kind: Schema.SchemaKind.Tag
  schema: $Schema
  data: null
}

export type ColumnOfSchema<$Schema extends Schema.AnySchema> =
  $Schema extends Schema.BinaryScalarSchema
    ? ScalarBinaryColumn<$Schema>
    : $Schema extends Schema.BinaryStructSchema
    ? ComplexBinaryColumn<$Schema>
    : $Schema extends Schema.NativeScalarSchema
    ? ScalarNativeColumn<$Schema>
    : $Schema extends Schema.NativeObjectSchema
    ? ComplexNativeColumn<$Schema>
    : $Schema extends Schema.TagSchema
    ? TagColumn
    : never

export type Column<$SchemaId extends Schema.Id = Schema.Id> = $SchemaId extends Schema.Id<
  infer $Schema
>
  ? ColumnOfSchema<$Schema>
  : never

export type Store<$Type extends Type.Struct> = {
  [K in keyof $Type]: $Type[K] extends Schema.Id ? Column<$Type[K]> : never
}

export type Struct<$Type extends Type.Struct = Type.Struct> = {
  edgesSet: Struct[]
  edgesUnset: Struct[]
  entities: Entity.Id[]
  entityIndex: number[]
  layout: number[]
  real: boolean
  onTableInsert: Signal.Struct<Struct>
  onRealize: Signal.Struct<void>
  store: Store<$Type>
  type: $Type
}

export type RowData<$Type extends Type.Struct> = {
  [K in keyof $Type]: $Type[K] extends Schema.Id ? Data<$Type[K]> : never
}

const ArrayBufferConstructor = globalThis.SharedArrayBuffer ?? globalThis.ArrayBuffer

function makeColumn(schema: Schema.AnySchema, size: number): Column {
  let data: Column["data"]
  switch (schema.kind) {
    case Schema.SchemaKind.BinaryScalar: {
      const buffer = new ArrayBufferConstructor(
        size * schema.shape.binary.BYTES_PER_ELEMENT,
      )
      data = new schema.shape.binary(buffer)
      break
    }
    case Schema.SchemaKind.BinaryStruct: {
      data = Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new ArrayBufferConstructor(
          size * memberNode.binary.BYTES_PER_ELEMENT,
        )
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {} as { [key: string]: Types.TypedArray })
      break
    }
    case Schema.SchemaKind.NativeScalar:
    case Schema.SchemaKind.NativeObject:
      data = []
      break
    case Schema.SchemaKind.Tag:
      data = null
      break
  }
  return { kind: schema.kind, schema, data } as Column
}

export function makeStore<$Type extends Type.Struct>(
  world: World.Struct,
  type: $Type,
): Store<$Type> {
  return type.map(id =>
    makeColumn(World.findSchemaById(world, id), world.size),
  ) as unknown as Store<$Type>
}

export function makeInner<$Type extends Type.Struct>(
  type: $Type,
  store: Store<$Type>,
): Struct<$Type> {
  Type.invariantNormalized(type)
  const layout: number[] = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    layout[id] = i
  }
  return {
    edgesSet: [],
    edgesUnset: [],
    entities: [],
    entityIndex: [],
    layout,
    real: false,
    onTableInsert: Signal.make(),
    onRealize: Signal.make(),
    store,
    type,
  }
}

export function make<$Type extends Type.Struct>(
  world: World.Struct,
  type: $Type,
): Struct<$Type> {
  const store = makeStore(world, type)
  return makeInner(type, store)
}

export function ensureReal(archetype: Struct) {
  if (!archetype.real) {
    archetype.real = true
    Signal.dispatch(archetype.onRealize, undefined)
  }
}

export function insert(
  archetype: Struct,
  entity: Entity.Id,
  components: ComponentSet.Struct,
) {
  const index = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const id = archetype.type[i]
    Debug.invariant(id !== undefined)
    const columnIndex = archetype.layout[id as number]
    Debug.invariant(columnIndex !== undefined)
    const column = archetype.store[columnIndex]
    Debug.invariant(column !== undefined)
    const kind = column.kind
    // insert components, skipping over tag schema
    if (kind !== Schema.SchemaKind.Tag) {
      const data = components[id] ?? Component.expressSchema(column.schema)
      Debug.invariant(data !== undefined)
      writeColumnData(column, archetype.entities.length, data)
    }
  }
  archetype.entities[index] = entity
  archetype.entityIndex[entity] = index
  ensureReal(archetype)
}

export function remove(archetype: Struct, entity: number) {
  const index = archetype.entityIndex[entity]
  const head = archetype.entities.pop()

  Debug.invariant(index !== undefined)
  Debug.invariant(head !== undefined)

  if (entity === head) {
    // pop
    for (let i = 0; i < archetype.store.length; i++) {
      const column = archetype.store[i]
      Debug.invariant(column !== undefined)
      switch (column.kind) {
        case Schema.SchemaKind.BinaryScalar:
          column.data[index] = 0
          break
        case Schema.SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            Debug.invariant(array !== undefined)
            array[index] = 0
          }
          break
        case Schema.SchemaKind.NativeScalar:
        case Schema.SchemaKind.NativeObject:
          column.data.pop()
          break
      }
    }
  } else {
    // swap
    const from = archetype.entities.length - 1
    for (let i = 0; i < archetype.store.length; i++) {
      const column = archetype.store[i]
      Debug.invariant(column !== undefined)
      switch (column.kind) {
        case Schema.SchemaKind.BinaryScalar:
          const data = column.data[from]
          Debug.invariant(data !== undefined)
          column.data[from] = 0
          column.data[index] = data
          break
        case Schema.SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            Debug.invariant(array !== undefined)
            const data = array[from]
            Debug.invariant(data !== undefined)
            array[from] = 0
            array[index] = data
          }
          break
        case Schema.SchemaKind.NativeScalar:
        case Schema.SchemaKind.NativeObject: {
          const data = column.data.pop()
          Debug.invariant(data !== undefined)
          column.data[index] = data
          break
        }
      }
    }
    archetype.entities[index] = head
    archetype.entityIndex[head] = index
  }

  archetype.entityIndex[entity] = -1
}

export function writeColumnData(column: Column, index: number, data: Data<Schema.Id>) {
  switch (column.kind) {
    case Schema.SchemaKind.BinaryStruct:
      Debug.invariant(typeof data === "object")
      for (const key in column.schema.shape) {
        const array = column.data[key]
        const value = data[key]
        Debug.invariant(array !== undefined)
        Debug.invariant(typeof value === "number")
        array[index] = value
      }
      break
    case Schema.SchemaKind.BinaryScalar:
    case Schema.SchemaKind.NativeScalar:
    case Schema.SchemaKind.NativeObject:
      column.data[index] = data
      break
  }
}

export function copyColumnData(
  prev: Column,
  next: Column,
  prevIndex: number,
  nextIndex: number,
) {
  switch (prev.kind) {
    case Schema.SchemaKind.BinaryStruct:
      Debug.invariant(prev.kind === next.kind)
      for (const key in prev.schema.shape) {
        const prevArray = prev.data[key]
        const nextArray = next.data[key]
        Debug.invariant(prevArray !== undefined)
        Debug.invariant(nextArray !== undefined)
        const value = prevArray[prevIndex]
        Debug.invariant(typeof value === "number")
        nextArray[nextIndex] = value
      }
      break
    case Schema.SchemaKind.BinaryScalar:
    case Schema.SchemaKind.NativeScalar:
    case Schema.SchemaKind.NativeObject: {
      Debug.invariant(prev.kind === next.kind)
      const value = prev.data[prevIndex]
      Debug.invariant(value !== undefined)
      next.data[nextIndex] = value
      break
    }
  }
}

export function move(
  entity: Entity.Id,
  prev: Struct,
  next: Struct,
  data?: ComponentSet.Struct,
) {
  const nextIndex = next.entities.length
  for (let i = 0; i < next.type.length; i++) {
    const id = next.type[i]
    Debug.invariant(id !== undefined)
    const columnIndex = prev.layout[id]
    const nextColumn = next.store[i]
    Debug.invariant(nextColumn !== undefined)
    if (nextColumn.kind === Schema.SchemaKind.Tag) {
      continue
    }
    if (columnIndex === undefined) {
      Debug.invariant(data !== undefined)
      const value = data[id] ?? Component.expressSchema(nextColumn.schema)
      Debug.invariant(value !== undefined)
      writeColumnData(nextColumn, nextIndex, value)
    } else {
      Debug.invariant(columnIndex !== undefined)
      const prevIndex = prev.entityIndex[entity]
      const prevColumn = prev.store[columnIndex]
      const value = data?.[id]
      Debug.invariant(prevIndex !== undefined)
      Debug.invariant(prevColumn !== undefined)
      if (value === undefined) {
        copyColumnData(prevColumn, nextColumn, prevIndex, nextIndex)
      } else {
        writeColumnData(nextColumn, nextIndex, value)
      }
    }
  }
  next.entities[nextIndex] = entity
  next.entityIndex[entity] = nextIndex
  ensureReal(next)
  remove(prev, entity)
}

export function read<$Type extends Type.Struct>(
  entity: Entity.Id,
  archetype: Struct,
  layout: $Type,
  out: unknown[],
) {
  const index = archetype.entityIndex[entity]
  Debug.invariant(index !== undefined)
  for (let i = 0; i < layout.length; i++) {
    const schemaId = layout[i]
    Debug.invariant(schemaId !== undefined)
    const columnIndex = archetype.layout[schemaId]
    Debug.invariant(columnIndex !== undefined)
    const column = archetype.store[columnIndex]
    Debug.invariant(column !== undefined)
    let value: unknown
    switch (column.kind) {
      case Schema.SchemaKind.BinaryStruct:
        const data = Component.expressBinaryShape(column.schema.shape)
        for (const prop in data) {
          data[prop] = column.data[prop]![index]!
        }
        value = data
        break
      case Schema.SchemaKind.Tag:
        value = undefined
        break
      default:
        value = column.data[index]
        break
    }
    out.push(value)
  }
  return out as unknown as RowData<$Type>
}

export function write(
  entity: Entity.Id,
  archetype: Struct,
  components: ComponentSet.Struct,
) {
  const index = archetype.entityIndex[entity]
  Debug.invariant(index !== undefined)
  for (let i = 0; i < archetype.store.length; i++) {
    const column = archetype.store[i]
    Debug.invariant(column !== undefined)
    const data = components[column.schema.id]
    if (data !== undefined) {
      writeColumnData(column, index, data)
    }
  }
}
