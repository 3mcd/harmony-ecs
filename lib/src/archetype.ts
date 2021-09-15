import { assert, invariant } from "./debug"
import { Entity } from "./entity"
import {
  BinarySchema,
  ComplexBinarySchema,
  ComplexNativeSchema,
  Format,
  NativeSchema,
  Schema,
  SchemaId,
  SchemaKind,
  Shape,
  SimpleBinarySchema,
  SimpleNativeSchema,
} from "./schema"
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

export type ShapeData<$Shape extends Shape<Schema>> = $Shape extends Shape<BinarySchema>
  ? BinaryData<$Shape>
  : $Shape extends Shape<NativeSchema>
  ? NativeData<$Shape>
  : never

export type Data<$SchemaId extends SchemaId> = $SchemaId extends SchemaId<infer $Schema>
  ? ShapeData<Shape<$Schema>>
  : never

type SimpleBinaryColumn<$Schema extends SimpleBinarySchema = SimpleBinarySchema> = {
  kind: SchemaKind.BinarySimple
  schema: $Schema
  data: Construct<Shape<$Schema>["binary"]>
}

type ComplexBinaryColumn<$Schema extends ComplexBinarySchema = ComplexBinarySchema> = {
  kind: SchemaKind.BinaryComplex
  schema: $Schema
  data: { [K in keyof Shape<$Schema>]: Construct<Shape<$Schema>[K]["binary"]> }
}

type SimpleNativeColumn<$Schema extends SimpleNativeSchema = SimpleNativeSchema> = {
  kind: SchemaKind.NativeSimple
  schema: $Schema
  data: number[]
}

type ComplexNativeColumn<$Schema extends ComplexNativeSchema = ComplexNativeSchema> = {
  kind: SchemaKind.NativeComplex
  schema: $Schema
  data: NativeData<Shape<$Schema>>[]
}

type DeriveColumnShape<$Schema extends Schema> = $Schema extends SimpleBinarySchema
  ? SimpleBinaryColumn<$Schema>
  : $Schema extends ComplexBinarySchema
  ? ComplexBinaryColumn<$Schema>
  : $Schema extends SimpleNativeSchema
  ? SimpleNativeColumn<$Schema>
  : $Schema extends ComplexNativeSchema
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
  length: number
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
    case SchemaKind.BinarySimple: {
      const buffer = new ArrayBufferConstructor(
        size * schema.shape.binary.BYTES_PER_ELEMENT,
      )
      data = new schema.shape.binary(buffer)
      break
    }
    case SchemaKind.BinaryComplex: {
      data = Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new ArrayBufferConstructor(
          size * memberNode.binary.BYTES_PER_ELEMENT,
        )
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {} as { [key: string]: TypedArray })
      break
    }
    case SchemaKind.NativeSimple:
    case SchemaKind.NativeComplex:
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
    length: 0,
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
    edgesSet: [],
    edgesUnset: [],
    entities,
    entityIndex,
    layout,
    length: 0,
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
  const length = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const schemaId = archetype.type[i]
    const value = data[i]
    invariant(schemaId !== undefined)
    invariant(value !== undefined)
    insert(archetype, schemaId, value)
  }
  archetype.entities[length] = entity
  archetype.entityIndex[entity] = length
  archetype.length++
  if (archetype.real === false) {
    archetype.real = true
    archetype.onRealize.dispatch()
  }
}

export function removeFromArchetype(archetype: Archetype, entity: number) {
  const currIndex = archetype.entityIndex[entity]
  const currHead = archetype.entities.pop()

  invariant(currIndex !== undefined)
  invariant(currHead !== undefined)

  if (currIndex === archetype.length - 1) {
    // entity was head
    for (let i = 0; i < archetype.type.length; i++) {
      const column = archetype.table[i]
      invariant(column !== undefined)
      switch (column.kind) {
        case SchemaKind.BinarySimple:
          column.data[currIndex] = 0
          break
        case SchemaKind.BinaryComplex:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            invariant(array !== undefined)
            array[currIndex] = 0
          }
          break
        case SchemaKind.NativeSimple:
        case SchemaKind.NativeComplex:
          column.data.pop()
          break
      }
    }
  } else {
    const src = archetype.length - 1
    for (let i = 0; i < archetype.type.length; i++) {
      const column = archetype.table[i]
      invariant(column !== undefined)
      switch (column.kind) {
        case SchemaKind.BinarySimple:
          const data = column.data[src]
          invariant(data !== undefined)
          column.data[src] = 0
          column.data[currIndex] = data
          break
        case SchemaKind.BinaryComplex:
          for (const key in column.schema.shape) {
            const array = column.data[key]
            invariant(array !== undefined)
            const data = array[src]
            invariant(data !== undefined)
            array[src] = 0
            array[currIndex] = data
          }
          break
        case SchemaKind.NativeSimple:
        case SchemaKind.NativeComplex: {
          const data = column.data.pop()
          invariant(data !== undefined)
          column.data[currIndex] = data
          break
        }
      }
    }
    archetype.entities[currIndex] = currHead
    archetype.entityIndex[currHead] = currIndex
  }

  archetype.entityIndex[entity] = -1
  archetype.length--
}

export function moveToArchetype<$SchemaId extends SchemaId>(
  prev: Archetype,
  next: Archetype,
  entity: number,
  schemaId?: $SchemaId,
  data?: Data<$SchemaId>,
) {
  if (prev.entityIndex[entity] === prev.length - 1) {
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
  const prevHead = prev.entities.pop()
  const nextType = next.type
  const prevType = prev.type
  const prevEnd = next.length - 1
  const prevIndex = prev.entityIndex[entity]
  const set = prevType.length < nextType.length

  invariant(prevHead !== undefined)
  invariant(prevIndex !== undefined)

  let i = 0
  let j = 0

  for (; i < prevType.length; i++) {
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    invariant(prevColumn !== undefined)
    const hit = prevType[i] === nextType[j]
    switch (prevColumn.kind) {
      case SchemaKind.BinarySimple: {
        if (hit) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const copy = prevColumn.data[prevIndex]
          invariant(copy !== undefined)
          nextColumn.data[next.length] = copy
        }
        const move = prevColumn.data[prevEnd]
        invariant(move !== undefined)
        prevColumn.data[prevIndex] = move
        prevColumn.data[prevEnd] = 0
        break
      }
      case SchemaKind.BinaryComplex:
        for (const key in prevColumn.schema.shape) {
          const prevArray = prevColumn.data[key]
          invariant(prevArray !== undefined)
          if (hit) {
            invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
            const copy = prevArray[prevIndex]
            invariant(copy !== undefined)
            const array = nextColumn.data[key]
            invariant(array !== undefined)
            array[next.length] = copy
          }
          const move = prevArray[prevEnd]
          invariant(move !== undefined)
          prevArray[prevIndex] = move
          prevArray[prevEnd] = 0
        }
        break
      case SchemaKind.NativeSimple:
      case SchemaKind.NativeComplex: {
        if (hit) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const copy = prevColumn.data[prevIndex]
          invariant(copy !== undefined)
          nextColumn.data[next.length] = copy
        }
        const move = prevColumn.data.pop()
        invariant(move !== undefined)
        prevColumn.data[prevIndex] = move
        break
      }
    }
    if (hit) j++
  }

  if (set) {
    invariant(schemaId !== undefined)
    invariant(data !== undefined)
    insert(next, schemaId, data)
  }

  next.entities[next.length] = entity
  next.entityIndex[entity] = next.length
  prev.entities[prevIndex] = prevHead
  prev.entityIndex[entity] = prevIndex
  prev.length--
  next.length++
}

export function moveToArchetypePop<$SchemaId extends SchemaId>(
  prev: Archetype,
  next: Archetype,
  schemaId?: $SchemaId,
  data?: Data<$SchemaId>,
) {
  const entity = prev.entities.pop()
  invariant(entity !== undefined)

  const prevIndex = prev.length - 1
  assert(
    prevIndex === prev.entityIndex[entity],
    `${entity} ${prev.type} ${next.type} ${prevIndex} ${prev.entityIndex[entity]}`,
  )
  invariant(prevIndex !== undefined)
  const nextType = next.type
  const prevType = prev.type
  const set = prevType.length < nextType.length
  let i = 0
  let j = 0
  for (; i < prevType.length; i++) {
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    invariant(prevColumn !== undefined)
    const hit = prevType[i] === nextType[j]
    switch (prevColumn.kind) {
      case SchemaKind.BinarySimple:
        if (hit) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          const value = prevColumn.data[prevIndex]
          invariant(value !== undefined)
          nextColumn.data[next.length] = value
        }
        prevColumn.data[prevIndex] = 0
        break
      case SchemaKind.BinaryComplex:
        for (const key in prevColumn.schema.shape) {
          const prevArray = prevColumn.data[key]
          invariant(prevArray !== undefined)
          if (hit) {
            invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
            const array = nextColumn.data[key]
            const value = prevArray[prevIndex]
            invariant(array !== undefined)
            invariant(value !== undefined)
            array[next.length] = value
          }
          prevArray[prevIndex] = 0
        }
        break
      case SchemaKind.NativeSimple:
      case SchemaKind.NativeComplex: {
        const data = prevColumn.data.pop()
        if (hit) {
          invariant(nextColumn !== undefined && nextColumn.kind === prevColumn.kind)
          invariant(data !== undefined)
          nextColumn.data[next.length] = data
        }
        break
      }
      default:
        break
    }
    if (hit) j++
  }
  if (set) {
    invariant(schemaId !== undefined)
    invariant(data !== undefined)
    insert(next, schemaId, data)
  }
  next.entities[next.length] = entity
  next.entityIndex[entity] = next.length
  prev.entityIndex[entity] = -1
  prev.length--
  next.length++
}

function insert<$SchemaId extends SchemaId>(
  archetype: Archetype,
  schemaId: $SchemaId,
  data: Data<$SchemaId>,
) {
  const columnIndex = archetype.layout[schemaId as number]
  invariant(columnIndex !== undefined)
  const column = archetype.table[columnIndex]
  invariant(column !== undefined)
  switch (column.kind) {
    case SchemaKind.BinarySimple:
      invariant(typeof data === "number")
      column.data[archetype.length] = data
      break
    case SchemaKind.BinaryComplex:
      for (const key in column.schema.shape) {
        invariant(typeof data === "object")
        const array = column.data[key]
        const value = data[key]
        invariant(array !== undefined)
        invariant(typeof value === "number")
        array[archetype.length] = value
      }
      break
    case SchemaKind.NativeSimple:
    case SchemaKind.NativeComplex:
      invariant(typeof data === "number" || typeof data === "object")
      column.data[archetype.length] = data
      break
  }
}

export function traverseSet(archetype: Archetype, schemaId: SchemaId) {
  return archetype.edgesSet[schemaId]
}

export function traverseUnset(archetype: Archetype, schemaId: SchemaId) {
  return archetype.edgesUnset[schemaId]
}
