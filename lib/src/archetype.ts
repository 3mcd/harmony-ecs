import * as Component from "./component"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Model from "./model"
import * as Signal from "./signal"
import * as Type from "./type"
import * as Types from "./types"
import * as World from "./world"

export type BinaryData<$Shape extends Model.Shape<Model.AnyBinarySchema>> =
  $Shape extends Format.Format ? number : { [K in keyof $Shape]: number }

export type NativeData<$Shape extends Model.Shape<Model.AnyNativeSchema>> =
  $Shape extends Format.Format
    ? number
    : {
        [K in keyof $Shape]: $Shape[K] extends Format.Format
          ? number
          : $Shape[K] extends Model.Shape<Model.AnyNativeSchema>
          ? NativeData<$Shape[K]>
          : never
      }

export type DataOfShape<$Shape extends Model.Shape<Model.AnySchema>> =
  $Shape extends Model.Shape<Model.AnyBinarySchema>
    ? BinaryData<$Shape>
    : $Shape extends Model.Shape<Model.AnyNativeSchema>
    ? NativeData<$Shape>
    : never

export type Data<$SchemaId extends Model.SchemaId> = $SchemaId extends Model.SchemaId<
  infer $Schema
>
  ? DataOfShape<Model.Shape<$Schema>>
  : never

type ScalarBinaryColumn<
  $Schema extends Model.BinaryScalarSchema = Model.BinaryScalarSchema,
> = {
  kind: Model.SchemaKind.BinaryScalar
  schema: $Schema
  data: Types.Construct<Model.Shape<$Schema>["binary"]>
}

type ComplexBinaryColumn<
  $Schema extends Model.BinaryStructSchema = Model.BinaryStructSchema,
> = {
  kind: Model.SchemaKind.BinaryStruct
  schema: $Schema
  data: {
    [K in keyof Model.Shape<$Schema>]: Types.Construct<Model.Shape<$Schema>[K]["binary"]>
  }
}

type ScalarNativeColumn<
  $Schema extends Model.NativeScalarSchema = Model.NativeScalarSchema,
> = {
  kind: Model.SchemaKind.NativeScalar
  schema: $Schema
  data: number[]
}

type ComplexNativeColumn<
  $Schema extends Model.NativeObjectSchema = Model.NativeObjectSchema,
> = {
  kind: Model.SchemaKind.NativeObject
  schema: $Schema
  data: NativeData<Model.Shape<$Schema>>[]
}

type DeriveColumn<$Schema extends Model.AnySchema> =
  $Schema extends Model.BinaryScalarSchema
    ? ScalarBinaryColumn<$Schema>
    : $Schema extends Model.BinaryStructSchema
    ? ComplexBinaryColumn<$Schema>
    : $Schema extends Model.NativeScalarSchema
    ? ScalarNativeColumn<$Schema>
    : $Schema extends Model.NativeObjectSchema
    ? ComplexNativeColumn<$Schema>
    : never

export type Column<$SchemaId extends Model.SchemaId = Model.SchemaId> =
  $SchemaId extends Model.SchemaId<infer $Schema> ? DeriveColumn<$Schema> : never

export type Store<$Type extends Type.Type> = {
  [K in keyof $Type]: $Type[K] extends Model.SchemaId ? Column<$Type[K]> : never
}

export type Table<$Type extends Type.Type = Type.Type> = {
  edgesSet: Table[]
  edgesUnset: Table[]
  entities: Entity.Id[]
  entityIndex: number[]
  layout: number[]
  real: boolean
  onTableInsert: Signal.Signal<Table>
  onRealize: Signal.Signal<void>
  onEnter: Signal.Signal<Entity.Id[]>
  onExit: Signal.Signal<Entity.Id[]>
  store: Store<$Type>
  type: $Type
}

export type Row<$Type extends Type.Type> = {
  [K in keyof $Type]: $Type[K] extends Model.SchemaId ? Data<$Type[K]> : never
}

const ArrayBufferConstructor = globalThis.SharedArrayBuffer ?? globalThis.ArrayBuffer

function makeColumn(schema: Model.AnySchema, size: number): Column {
  let data: Column["data"]
  switch (schema.kind) {
    case Model.SchemaKind.BinaryScalar: {
      const buffer = new ArrayBufferConstructor(
        size * schema.shape.binary.BYTES_PER_ELEMENT,
      )
      data = new schema.shape.binary(buffer)
      break
    }
    case Model.SchemaKind.BinaryStruct: {
      data = Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new ArrayBufferConstructor(
          size * memberNode.binary.BYTES_PER_ELEMENT,
        )
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {} as { [key: string]: Types.TypedArray })
      break
    }
    case Model.SchemaKind.NativeScalar:
    case Model.SchemaKind.NativeObject:
      data = []
      break
  }
  return { kind: schema.kind, schema, data } as Column
}

export function makeStore<$Type extends Type.Type>(
  world: World.World,
  type: $Type,
): Store<$Type> {
  return type.map(id =>
    makeColumn(World.findSchemaById(world, id), world.size),
  ) as unknown as Store<$Type>
}

export function makeInner<$Type extends Type.Type>(
  type: $Type,
  store: Store<$Type>,
): Table<$Type> {
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
    onEnter: Signal.make(),
    onExit: Signal.make(),
    store,
    type,
  }
}

export function make<$Type extends Type.Type>(
  world: World.World,
  type: $Type,
): Table<$Type> {
  const store = makeStore(world, type)
  return makeInner(type, store)
}

export function ensureReal(archetype: Table) {
  if (!archetype.real) {
    archetype.real = true
    Signal.dispatch(archetype.onRealize, undefined)
  }
}

export function insert(table: Table, entity: Entity.Id, set: Component.ComponentSet) {
  const index = table.entities.length
  for (let i = 0; i < table.type.length; i++) {
    const id = table.type[i]
    Debug.invariant(id !== undefined)
    const data = set[id]
    Debug.invariant(data !== undefined)
    const length = table.entities.length
    const columnIndex = table.layout[id as number]
    Debug.invariant(columnIndex !== undefined)
    const column = table.store[columnIndex]
    Debug.invariant(column !== undefined)
    switch (column.kind) {
      case Model.SchemaKind.BinaryScalar:
        Debug.invariant(typeof data === "number")
        column.data[length] = data
        break
      case Model.SchemaKind.BinaryStruct:
        for (const key in column.schema.shape) {
          Debug.invariant(typeof data === "object")
          const nextArray = column.data[key]
          const value = data[key]
          Debug.invariant(nextArray !== undefined)
          Debug.invariant(typeof value === "number")
          nextArray[length] = value
        }
        break
      case Model.SchemaKind.NativeScalar:
      case Model.SchemaKind.NativeObject:
        Debug.invariant(typeof data === "number" || typeof data === "object")
        column.data[length] = data
        break
    }
  }
  table.entities[index] = entity
  table.entityIndex[entity] = index
  ensureReal(table)
}

export function remove(table: Table, entity: number) {
  const index = table.entityIndex[entity]
  const head = table.entities.pop()

  Debug.invariant(index !== undefined)
  Debug.invariant(head !== undefined)

  if (entity === head) {
    // pop
    for (let i = 0; i < table.store.length; i++) {
      const column = table.store[i]
      Debug.invariant(column !== undefined)
      switch (column.kind) {
        case Model.SchemaKind.BinaryScalar:
          column.data[index] = 0
          break
        case Model.SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            Debug.invariant(array !== undefined)
            array[index] = 0
          }
          break
        case Model.SchemaKind.NativeScalar:
        case Model.SchemaKind.NativeObject:
          column.data.pop()
          break
      }
    }
  } else {
    // swap
    const from = table.entities.length - 1
    for (let i = 0; i < table.store.length; i++) {
      const column = table.store[i]
      Debug.invariant(column !== undefined)
      switch (column.kind) {
        case Model.SchemaKind.BinaryScalar:
          const data = column.data[from]
          Debug.invariant(data !== undefined)
          column.data[from] = 0
          column.data[index] = data
          break
        case Model.SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            Debug.invariant(array !== undefined)
            const data = array[from]
            Debug.invariant(data !== undefined)
            array[from] = 0
            array[index] = data
          }
          break
        case Model.SchemaKind.NativeScalar:
        case Model.SchemaKind.NativeObject: {
          const data = column.data.pop()
          Debug.invariant(data !== undefined)
          column.data[index] = data
          break
        }
      }
    }
    table.entities[index] = head
    table.entityIndex[head] = index
  }

  table.entityIndex[entity] = -1
}

export function writeColumnData(
  column: Column,
  index: number,
  data: Data<Model.SchemaId>,
) {
  switch (column.kind) {
    case Model.SchemaKind.BinaryStruct:
      Debug.invariant(typeof data === "object")
      for (const key in column.schema.shape) {
        const array = column.data[key]
        const value = data[key]
        Debug.invariant(array !== undefined)
        Debug.invariant(typeof value === "number")
        array[index] = value
      }
      break
    case Model.SchemaKind.BinaryScalar:
    case Model.SchemaKind.NativeScalar:
    case Model.SchemaKind.NativeObject:
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
    case Model.SchemaKind.BinaryStruct:
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
    case Model.SchemaKind.BinaryScalar:
    case Model.SchemaKind.NativeScalar:
    case Model.SchemaKind.NativeObject: {
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
  prev: Table,
  next: Table,
  components?: Component.ComponentSet,
) {
  const nextIndex = next.entities.length
  for (let i = 0; i < next.type.length; i++) {
    const id = next.type[i]
    Debug.invariant(id !== undefined)
    const columnIndex = prev.layout[id]
    const nextColumn = next.store[i]
    Debug.invariant(nextColumn !== undefined)
    if (columnIndex === undefined) {
      Debug.invariant(components !== undefined)
      const value = components[id]
      Debug.invariant(value !== undefined)
      writeColumnData(nextColumn, nextIndex, value)
    } else {
      Debug.invariant(columnIndex !== undefined)
      const prevIndex = prev.entityIndex[entity]
      const prevColumn = prev.store[columnIndex]
      const value = components?.[id]
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

export function write(
  entity: Entity.Id,
  archetype: Table,
  components: Component.ComponentSet,
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
