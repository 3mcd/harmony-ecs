import { ComponentSet } from "./component"
import { invariant } from "./debug"
import { Entity } from "./entity"
import {
  BinaryScalarSchema,
  BinarySchema,
  BinaryStructSchema,
  Format,
  NativeObjectSchema,
  NativeScalarSchema,
  NativeSchema,
  Schema,
  SchemaId,
  SchemaKind,
  Shape,
} from "./model"
import { dispatch, makeSignal, Signal } from "./signal"
import { invariantTypeNormalized, Type } from "./type"
import { Construct, TypedArray } from "./types"
import { findSchemaById, World } from "./world"

export type BinaryData<$Shape extends Shape<BinarySchema>> = $Shape extends Format
  ? number
  : { [K in keyof $Shape]: number }

export type NativeData<$Shape extends Shape<NativeSchema>> = $Shape extends Format
  ? number
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? number
        : $Shape[K] extends Shape<NativeSchema>
        ? NativeData<$Shape[K]>
        : never
    }

export type DataOfShape<$Shape extends Shape<Schema>> = $Shape extends Shape<BinarySchema>
  ? BinaryData<$Shape>
  : $Shape extends Shape<NativeSchema>
  ? NativeData<$Shape>
  : never

export type Data<$SchemaId extends SchemaId> = $SchemaId extends SchemaId<infer $Schema>
  ? DataOfShape<Shape<$Schema>>
  : never

type ScalarBinaryColumn<$Schema extends BinaryScalarSchema = BinaryScalarSchema> = {
  kind: SchemaKind.BinaryScalar
  schema: $Schema
  data: Construct<Shape<$Schema>["binary"]>
}

type ComplexBinaryColumn<$Schema extends BinaryStructSchema = BinaryStructSchema> = {
  kind: SchemaKind.BinaryStruct
  schema: $Schema
  data: { [K in keyof Shape<$Schema>]: Construct<Shape<$Schema>[K]["binary"]> }
}

type ScalarNativeColumn<$Schema extends NativeScalarSchema = NativeScalarSchema> = {
  kind: SchemaKind.NativeScalar
  schema: $Schema
  data: number[]
}

type ComplexNativeColumn<$Schema extends NativeObjectSchema = NativeObjectSchema> = {
  kind: SchemaKind.NativeObject
  schema: $Schema
  data: NativeData<Shape<$Schema>>[]
}

type DeriveColumnShape<$Schema extends Schema> = $Schema extends BinaryScalarSchema
  ? ScalarBinaryColumn<$Schema>
  : $Schema extends BinaryStructSchema
  ? ComplexBinaryColumn<$Schema>
  : $Schema extends NativeScalarSchema
  ? ScalarNativeColumn<$Schema>
  : $Schema extends NativeObjectSchema
  ? ComplexNativeColumn<$Schema>
  : never

export type ArchetypeColumn<$SchemaId extends SchemaId = SchemaId> =
  $SchemaId extends SchemaId<infer $Schema> ? DeriveColumnShape<$Schema> : never

export type ArchetypeTable<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId ? ArchetypeColumn<$Type[K]> : never
}

export type Archetype<$Type extends Type = Type> = {
  edgesSet: Archetype[]
  edgesUnset: Archetype[]
  entities: Entity[]
  entityIndex: number[]
  layout: number[]
  real: boolean
  onArchetypeInsert: Signal<Archetype>
  onRealize: Signal<void>
  onEnter: Signal<Entity[]>
  onExit: Signal<Entity[]>
  table: ArchetypeTable<$Type>
  type: $Type
}

export type ArchetypeRow<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId ? Data<$Type[K]> : never
}

const ArrayBufferConstructor = globalThis.SharedArrayBuffer ?? globalThis.ArrayBuffer

function makeArchetypeColumn(schema: Schema, size: number): ArchetypeColumn {
  let data: ArchetypeColumn["data"]
  switch (schema.kind) {
    case SchemaKind.BinaryScalar: {
      const buffer = new ArrayBufferConstructor(
        size * schema.shape.binary.BYTES_PER_ELEMENT,
      )
      data = new schema.shape.binary(buffer)
      break
    }
    case SchemaKind.BinaryStruct: {
      data = Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new ArrayBufferConstructor(
          size * memberNode.binary.BYTES_PER_ELEMENT,
        )
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {} as { [key: string]: TypedArray })
      break
    }
    case SchemaKind.NativeScalar:
    case SchemaKind.NativeObject:
      data = []
      break
  }
  return { kind: schema.kind, schema, data } as ArchetypeColumn
}

function makeArchetypeTable<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeTable<$Type> {
  return type.map(id =>
    makeArchetypeColumn(findSchemaById(world, id), world.size),
  ) as unknown as ArchetypeTable<$Type>
}

export function makeRootArchetype(): Archetype {
  return {
    edgesSet: [],
    edgesUnset: [],
    entities: [],
    entityIndex: [],
    layout: [],
    real: false,
    onArchetypeInsert: makeSignal(),
    onRealize: makeSignal(),
    onEnter: makeSignal(),
    onExit: makeSignal(),
    table: [],
    type: [],
  }
}

export function makeArchetype<$Type extends Type>(
  world: World,
  type: $Type,
): Archetype<$Type> {
  invariantTypeNormalized(type)
  const entities: Entity[] = []
  const entityIndex: number[] = []
  const table = makeArchetypeTable(world, type)
  const layout: number[] = []
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    layout[id] = i
  }
  return {
    edgesSet: [],
    edgesUnset: [],
    entities,
    entityIndex,
    layout,
    real: false,
    onArchetypeInsert: makeSignal(),
    onRealize: makeSignal(),
    onEnter: makeSignal(),
    onExit: makeSignal(),
    table,
    type,
  }
}

export function ensureRealArchetype(archetype: Archetype) {
  if (!archetype.real) {
    archetype.real = true
    dispatch(archetype.onRealize, undefined)
  }
}

export function insertIntoArchetype<$Type extends Type>(
  archetype: Archetype,
  entity: Entity,
  set: ComponentSet,
) {
  const index = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const id = archetype.type[i]
    invariant(id !== undefined)
    const data = set[id]
    invariant(data !== undefined)
    const length = archetype.entities.length
    const columnIndex = archetype.layout[id as number]
    invariant(columnIndex !== undefined)
    const column = archetype.table[columnIndex]
    invariant(column !== undefined)
    switch (column.kind) {
      case SchemaKind.BinaryScalar:
        invariant(typeof data === "number")
        column.data[length] = data
        break
      case SchemaKind.BinaryStruct:
        for (const key in column.schema.shape) {
          invariant(typeof data === "object")
          const nextArray = column.data[key]
          const value = data[key]
          invariant(nextArray !== undefined)
          invariant(typeof value === "number")
          nextArray[length] = value
        }
        break
      case SchemaKind.NativeScalar:
      case SchemaKind.NativeObject:
        invariant(typeof data === "number" || typeof data === "object")
        column.data[length] = data
        break
    }
  }
  archetype.entities[index] = entity
  archetype.entityIndex[entity] = index
  ensureRealArchetype(archetype)
}

export function removeFromArchetype(archetype: Archetype, entity: number) {
  const index = archetype.entityIndex[entity]
  const head = archetype.entities.pop()

  invariant(index !== undefined)
  invariant(head !== undefined)

  if (entity === head) {
    // pop
    for (let i = 0; i < archetype.table.length; i++) {
      const column = archetype.table[i]
      invariant(column !== undefined)
      switch (column.kind) {
        case SchemaKind.BinaryScalar:
          column.data[index] = 0
          break
        case SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            invariant(array !== undefined)
            array[index] = 0
          }
          break
        case SchemaKind.NativeScalar:
        case SchemaKind.NativeObject:
          column.data.pop()
          break
      }
    }
  } else {
    // swap
    const from = archetype.entities.length - 1
    for (let i = 0; i < archetype.table.length; i++) {
      const column = archetype.table[i]
      invariant(column !== undefined)
      switch (column.kind) {
        case SchemaKind.BinaryScalar:
          const data = column.data[from]
          invariant(data !== undefined)
          column.data[from] = 0
          column.data[index] = data
          break
        case SchemaKind.BinaryStruct:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            invariant(array !== undefined)
            const data = array[from]
            invariant(data !== undefined)
            array[from] = 0
            array[index] = data
          }
          break
        case SchemaKind.NativeScalar:
        case SchemaKind.NativeObject: {
          const data = column.data.pop()
          invariant(data !== undefined)
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

export function writeColumnData(
  column: ArchetypeColumn,
  index: number,
  data: Data<SchemaId>,
) {
  switch (column.kind) {
    case SchemaKind.BinaryStruct:
      invariant(typeof data === "object")
      for (const key in column.schema.shape) {
        const array = column.data[key]
        const value = data[key]
        invariant(array !== undefined)
        invariant(typeof value === "number")
        array[index] = value
      }
      break
    case SchemaKind.BinaryScalar:
    case SchemaKind.NativeScalar:
    case SchemaKind.NativeObject:
      column.data[index] = data
      break
  }
}

export function copyColumnData(
  prev: ArchetypeColumn,
  next: ArchetypeColumn,
  prevIndex: number,
  nextIndex: number,
) {
  switch (prev.kind) {
    case SchemaKind.BinaryStruct:
      invariant(prev.kind === next.kind)
      for (const key in prev.schema.shape) {
        const prevArray = prev.data[key]
        const nextArray = next.data[key]
        invariant(prevArray !== undefined)
        invariant(nextArray !== undefined)
        const value = prevArray[prevIndex]
        invariant(typeof value === "number")
        nextArray[nextIndex] = value
      }
      break
    case SchemaKind.BinaryScalar:
    case SchemaKind.NativeScalar:
    case SchemaKind.NativeObject: {
      invariant(prev.kind === next.kind)
      const value = prev.data[prevIndex]
      invariant(value !== undefined)
      next.data[nextIndex] = value
      break
    }
  }
}

export function moveEntity(
  entity: Entity,
  prev: Archetype,
  next: Archetype,
  data?: ComponentSet,
) {
  const nextIndex = next.entities.length
  for (let i = 0; i < next.type.length; i++) {
    const id = next.type[i]
    invariant(id !== undefined)
    const j = prev.layout[id]
    const nextColumn = next.table[i]
    invariant(nextColumn !== undefined)
    if (j === undefined) {
      invariant(data !== undefined)
      const value = data[id]
      invariant(value !== undefined)
      writeColumnData(nextColumn, nextIndex, value)
    } else {
      invariant(j !== undefined)
      const prevIndex = prev.entityIndex[entity]
      const prevColumn = prev.table[j]
      const value = data?.[id]
      invariant(prevIndex !== undefined)
      invariant(prevColumn !== undefined)
      if (value === undefined) {
        copyColumnData(prevColumn, nextColumn, prevIndex, nextIndex)
      } else {
        writeColumnData(nextColumn, nextIndex, value)
      }
    }
  }
  next.entities[nextIndex] = entity
  next.entityIndex[entity] = nextIndex
  ensureRealArchetype(next)
  removeFromArchetype(prev, entity)
}
