import { invariant } from "./debug"
import { Entity } from "./entity"
import {
  BinarySchema,
  BinaryObjectSchema,
  NativeObjectSchema,
  Format,
  NativeSchema,
  Schema,
  SchemaId,
  SchemaKind,
  Shape,
  BinaryScalarSchema,
  NativeScalarSchema,
} from "./model"
import { makeSignal, Signal } from "./signal"
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

type ComplexBinaryColumn<$Schema extends BinaryObjectSchema = BinaryObjectSchema> = {
  kind: SchemaKind.BinaryObject
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
  : $Schema extends BinaryObjectSchema
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
  table: ArchetypeTable<$Type>
  type: $Type
}

export type ArchetypeData<$Type extends Type> = {
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
    case SchemaKind.BinaryObject: {
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
  return type.map(schemaId =>
    makeArchetypeColumn(findSchemaById(world, schemaId), world.size),
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
  const entityIndex: number[] = Array(world.size)
  const table = makeArchetypeTable(world, type)
  const layout: number[] = []
  for (let i = 0; i < type.length; i++) {
    const schemaId = type[i]
    invariant(schemaId !== undefined)
    layout[schemaId] = i
  }
  return {
    // @ts-ignore
    id: Math.random(),
    edgesSet: [],
    edgesUnset: [],
    entities,
    entityIndex,
    layout,
    real: false,
    onArchetypeInsert: makeSignal(),
    onRealize: makeSignal(),
    table,
    type,
  }
}

export function insertIntoArchetype<$Type extends Type>(
  archetype: Archetype,
  entity: Entity,
  data: ArchetypeData<$Type>,
) {
  const index = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const schemaId = archetype.type[i]
    const value = data[i]
    invariant(schemaId !== undefined)
    invariant(value !== undefined)
    insert(archetype, schemaId, value)
  }
  archetype.entities[index] = entity
  archetype.entityIndex[entity] = index
  if (archetype.real === false) {
    archetype.real = true
    archetype.onRealize.dispatch()
  }
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
        case SchemaKind.BinaryObject:
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
        case SchemaKind.BinaryObject:
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

export function moveToArchetype<$SchemaId extends SchemaId>(
  prev: Archetype,
  next: Archetype,
  entity: number,
  schemaId?: $SchemaId,
  data?: Data<$SchemaId>,
) {
  if (prev.entityIndex[entity] === prev.entities.length - 1) {
    moveToArchetypePop(prev, next, schemaId, data)
  } else {
    moveToArchetypeSwap(prev, next, entity, schemaId, data)
  }
  if (next.real === false) {
    next.real = true
    next.onRealize.dispatch()
  }
}

export function moveToArchetypeSwap<$SchemaId extends SchemaId>(
  prev: Archetype,
  next: Archetype,
  entity: number,
  schemaId?: $SchemaId,
  data?: Data<$SchemaId>,
) {
  const nextIndex = next.entities.length
  const swapIndex = prev.entities.length - 1
  const prevHead = prev.entities.pop()
  const prevIndex = prev.entityIndex[entity]
  const set = prev.type.length < next.type.length

  invariant(prevHead !== undefined)
  invariant(prevIndex !== undefined)

  let i = 0
  let j = 0

  for (; i < prev.type.length; i++) {
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    invariant(prevColumn !== undefined)
    const copy = prev.type[i] === next.type[j]
    switch (prevColumn.kind) {
      case SchemaKind.BinaryScalar: {
        if (copy) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const copyValue = prevColumn.data[prevIndex]
          invariant(copyValue !== undefined)
          nextColumn.data[nextIndex] = copyValue
        }
        const swapValue = prevColumn.data[swapIndex]
        invariant(swapValue !== undefined)
        prevColumn.data[prevIndex] = swapValue
        prevColumn.data[swapIndex] = 0
        break
      }
      case SchemaKind.BinaryObject:
        for (const key in prevColumn.schema.shape) {
          const prevArray = prevColumn.data[key]
          invariant(prevArray !== undefined)
          if (copy) {
            invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
            const copyValue = prevArray[prevIndex]
            invariant(copyValue !== undefined)
            const nextArray = nextColumn.data[key]
            invariant(nextArray !== undefined)
            nextArray[nextIndex] = copyValue
          }
          const swapValue = prevArray[swapIndex]
          invariant(swapValue !== undefined)
          prevArray[prevIndex] = swapValue
          prevArray[swapIndex] = 0
        }
        break
      case SchemaKind.NativeScalar:
      case SchemaKind.NativeObject: {
        if (copy) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const copyValue = prevColumn.data[prevIndex]
          invariant(copyValue !== undefined)
          nextColumn.data[nextIndex] = copyValue
        }
        const swapValue = prevColumn.data.pop()
        invariant(swapValue !== undefined)
        prevColumn.data[prevIndex] = swapValue
        break
      }
    }
    if (copy) j++
  }

  if (set) {
    invariant(schemaId !== undefined)
    invariant(data !== undefined)
    insert(next, schemaId, data)
  }

  next.entities[nextIndex] = entity
  next.entityIndex[entity] = nextIndex
  prev.entities[prevIndex] = prevHead
  prev.entityIndex[prevHead] = prevIndex
  prev.entityIndex[entity] = -1
}

export function moveToArchetypePop<$SchemaId extends SchemaId>(
  prev: Archetype,
  next: Archetype,
  schemaId?: $SchemaId,
  data?: Data<$SchemaId>,
) {
  const prevIndex = prev.entities.length - 1
  const nextIndex = next.entities.length
  const entity = prev.entities.pop()
  const set = prev.type.length < next.type.length
  invariant(entity !== undefined)
  let i = 0
  let j = 0
  for (; i < prev.type.length; i++) {
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    invariant(prevColumn !== undefined)
    const copy = prev.type[i] === next.type[j]
    switch (prevColumn.kind) {
      case SchemaKind.BinaryScalar:
        if (copy) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const copyValue = prevColumn.data[prevIndex]
          invariant(copyValue !== undefined)
          nextColumn.data[nextIndex] = copyValue
        }
        prevColumn.data[prevIndex] = 0
        break
      case SchemaKind.BinaryObject:
        for (const key in prevColumn.schema.shape) {
          const prevArray = prevColumn.data[key]
          invariant(prevArray !== undefined)
          if (copy) {
            invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
            const nextArray = nextColumn.data[key]
            const copyValue = prevArray[prevIndex]
            invariant(nextArray !== undefined)
            invariant(copyValue !== undefined)
            nextArray[nextIndex] = copyValue
          }
          prevArray[prevIndex] = 0
        }
        break
      case SchemaKind.NativeScalar:
      case SchemaKind.NativeObject: {
        const copyValue = prevColumn.data.pop()
        if (copy) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          invariant(copyValue !== undefined)
          nextColumn.data[nextIndex] = copyValue
        }
        break
      }
      default:
        break
    }
    if (copy) j++
  }
  if (set) {
    invariant(schemaId !== undefined)
    invariant(data !== undefined)
    insert(next, schemaId, data)
  }
  next.entities[nextIndex] = entity
  next.entityIndex[entity] = nextIndex
  prev.entityIndex[entity] = -1
}

function insert<$SchemaId extends SchemaId>(
  archetype: Archetype,
  schemaId: $SchemaId,
  data: Data<$SchemaId>,
) {
  const length = archetype.entities.length
  const columnIndex = archetype.layout[schemaId as number]
  invariant(columnIndex !== undefined)
  const column = archetype.table[columnIndex]
  invariant(column !== undefined)
  switch (column.kind) {
    case SchemaKind.BinaryScalar:
      invariant(typeof data === "number")
      column.data[length] = data
      break
    case SchemaKind.BinaryObject:
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

export function traverseSet(archetype: Archetype, schemaId: SchemaId) {
  return archetype.edgesSet[schemaId]
}

export function traverseUnset(archetype: Archetype, schemaId: SchemaId) {
  return archetype.edgesUnset[schemaId]
}
