import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Type from "./type"
import * as Types from "./types"
import * as Signal from "./signal"
import * as ComponentSet from "./component_set"

export type Signals = {
  onTableGrow: Signal.Struct<Struct>
}

export type Layout = (Schema.Struct | null)[]

type ColumnObject = unknown[]
type ColumnScalar = Types.TypedArray
type ColumnBinaryStruct = { [key: string]: Types.TypedArray }

/**
 * A densely packed vector of component data.
 */
type Column = ColumnObject | ColumnScalar | ColumnBinaryStruct

/**
 * A row of table data associated with a single entity. Data-less components
 * are mapped to `null`.
 */
export type Row<T extends Type.Struct> = {
  [K in keyof T]: T[K] extends Entity.Id<infer _>
    ? _ extends Schema.Struct
      ? Schema.Express<_>
      : null
    : never
}

function makeTypedArrayColumn(format: Format.Struct, size: number) {
  return new format.binary(
    new (globalThis.SharedArrayBuffer ?? globalThis.ArrayBuffer)(
      size * format.binary.BYTES_PER_ELEMENT,
    ),
  )
}

/**
 * Make a table column.
 */
function makeColumn(schema: Schema.Struct, size: number): Column {
  switch (schema.type) {
    case Schema.Type.Binary:
      return Object.entries(schema.shape).reduce<ColumnBinaryStruct>(
        (a, [memberName, memberNode]) => {
          a[memberName] = makeTypedArrayColumn(memberNode, size)
          return a
        },
        {},
      )
    case Schema.Type.Object:
      return []
    case Schema.Type.Scalar:
      return makeTypedArrayColumn(schema.shape, size)
  }
}

function moveUnsafe(
  entity: Entity.Id,
  prevIndex: number,
  prevTable: Struct,
  nextTable: Struct,
  data?: ComponentSet.Struct,
) {
  const nextIndex = nextTable.length[0]++
  for (let i = 0; i < nextTable.type.length; i++) {
    let id = nextTable.type[i]
    let prevColumn = prevTable.columns[id]
    let nextColumn = nextTable.columns[id]
    // Skip data-less components
    if (nextColumn === null || nextColumn === undefined) continue
    // Previous table doesn't have component, so there is no data to copy
    if (prevColumn === undefined) {
      const value = data![id] ?? Schema.express(nextTable.layout[i]!)
      writeColumnData(nextColumn, nextIndex, value)
    } else {
      const value = data?.[id]
      if (value === undefined) {
        copyColumnData(prevColumn, nextColumn, prevIndex, nextIndex)
      } else {
        writeColumnData(nextColumn, nextIndex, value)
      }
    }
  }
  nextTable.entities[nextIndex] = entity
  remove(prevTable, entity)
  return nextIndex
}

function removeUnsafe(table: Struct, index: number) {
  const length = table.length[0]
  // const head = table.entities[table.length[0] - 1]

  if (index === length - 1) {
    // pop
    for (let i = 0; i < table.type.length; i++) {
      const id = table.type[i]
      const schema = table.layout[id]
      const column = table.columns[id]
      if (schema === null || schema === undefined) continue
      switch (schema.type) {
        case Schema.Type.Scalar:
          ;(column as ColumnScalar)[index] = 0
          break
        case Schema.Type.Binary:
          for (let j = 0; j < schema.keys.length; j++) {
            ;(column as ColumnBinaryStruct)[schema.keys[j]][index] = 0
          }
          break
        case Schema.Type.Object:
          ;(column as ColumnObject).pop()
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

/**
 * A table of entity data shared by entities of a common archetype.
 */
export type Struct<T extends Type.Struct = Type.Struct> = {
  /**
   * The number of iterators actively iterating over this table. The table is
   * released to other threads when this value reaches zero.
   */
  activeIteratorCount: number

  /**
   * Sparse array that maps component (or entity) identifiers to a table
   * column. A null value represents a data-less component, like a tag or
   * relationship.
   */
  columns: (Column | null | undefined)[]

  /**
   * Array of entities stored in the table.
   */
  entities: Uint32Array

  /**
   * A vector of schema that describes the format of data stored in each
   * column. A null value represents a data-less component, like a tag or
   * relationship.
   */
  layout: Layout

  /**
   * The number of entities stored in the table.
   */
  length: Uint32Array

  /**
   * A lock that, once acquired, limits table read/write operations to the
   * acquiring thread.
   */
  lock: Lock.Struct

  /**
   * Multiplier used to expand table columns when the table runs out of space
   * To reduce the number of resize events, a heuristic is used to increase
   * this value automatically each time a resize occurs.
   */
  scaleFactor: number

  /**
   * The type signature of the table.
   */
  type: T
}

/**
 * Make a table.
 */
export function make<T extends Type.Struct>(
  type: T,
  layout: Layout,
  initialSize: number,
  initialScaleFactor = 1.2,
): Struct<T> {
  let sharedEntities = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * initialSize)
  let sharedLength = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let sharedLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let columns: (Column | null | undefined)[] = []

  for (let i = 0; i < type.length; i++) {
    let schema = layout[i]
    columns[type[i]] = schema ? makeColumn(schema, initialSize) : null
  }

  return {
    activeIteratorCount: 0,
    columns,
    entities: new Uint32Array(sharedEntities),
    layout,
    length: new Uint32Array(sharedLength),
    lock: Lock.make(sharedLock),
    scaleFactor: initialScaleFactor,
    type,
  }
}

export function growArrayBufferUnsafe(array: Types.TypedArray, size: number) {
  let next = new SharedArrayBuffer(size * array.BYTES_PER_ELEMENT)
  new Uint8Array(next).set(new Uint8Array(array.buffer))
  return next
}

export function growUnsafe(table: Struct) {
  let size = Math.ceil(table.scaleFactor * table.length[0])

  table.entities = new Uint32Array(growArrayBufferUnsafe(table.entities, size))

  for (let i = 0; i < table.type.length; i++) {
    let schema = table.layout[i]
    // Skip data-less components and native object arrays
    if (schema === null || schema.type === Schema.Type.Object) continue
    let id = table.type[i]
    let column = table.columns[id]
    if (schema.type === Schema.Type.Scalar) {
      table.columns[id] = new schema.shape.binary(
        growArrayBufferUnsafe(column as Types.TypedArray, size),
      )
    } else {
      // Resize each member in the binary struct
      for (let prop in schema.shape) {
        ;(column as ColumnBinaryStruct)[prop] = new schema.shape[prop].binary(
          growArrayBufferUnsafe(column as Types.TypedArray, size),
        )
      }
    }
  }

  table.scaleFactor *= 1.2
}

export async function insertUnsafe<T extends Type.Struct>(
  table: Struct<T>,
  entity: Entity.Id,
  data: Row<T>,
  signals: Signals,
) {
  // Acquire a new index
  let index = table.length[0]++
  // Grow the table if we have reached the a maximum size
  if (index === table.entities.length) {
    growUnsafe(table)
    Signal.dispatch(signals.onTableGrow, table)
  }

  table.entities[index] = entity

  for (let i = 0; i < table.type.length; i++) {
    let id = table.type[i]
    let schema = table.layout[i]
    // Skip data-less components like tags, entities, and relationships
    if (schema === null) continue
    let column = table.columns[id]
    if (schema.type === Schema.Type.Binary) {
      // Update each field in the binary struct
      for (let j = 0; j < schema.keys.length; j++) {
        let key = schema.keys[i]
        ;(column as ColumnBinaryStruct)[key][index] = data[i]![key]
      }
    } else {
      // push the scalar or object value into the target array
      ;(column as ColumnObject)[index] = data[i]
    }
  }

  return index
}

export async function insert<T extends Type.Struct>(
  table: Struct<T>,
  entity: Entity.Id,
  data: Row<T>,
  signals: Signals,
) {
  let index: Promise<number>

  if (table.activeIteratorCount > 0) {
    // The thread already has a lock on the table within an iterator, so we
    // continue the insert without acquiring a lock
    index = insertUnsafe(table, entity, data, signals)
  } else {
    // Function was not called within an iterator, so we must acquire a lock
    // before mutating the table
    await Lock.lockThreadAware(table.lock)
    index = insertUnsafe(table, entity, data, signals)
    Lock.unlock(table.lock)
  }

  return index
}

export function iter<T extends Type.Struct>(table: Struct<T>) {
  let i = 0
  let iteratorResult = { value: -1, done: false }
  let iterator = { next, return: finalizeTableIterator }
  let iterable = {
    [Symbol.iterator]: function getTableIterator() {
      return iterator
    },
  }

  /**
   * Reset the iterator state and increment the iterator counter
   */
  async function initializeTableIterator() {
    iteratorResult.done = false
    // Acquire a lock on the table if this is the first iteration
    if (table.activeIteratorCount++ === 0) await Lock.lockThreadAware(table.lock)
    i = table.length[0] - 1
    return iterable
  }

  /**
   * Clean up the iterator, decrement the table's iterator counter and release
   * the table to other threads if no more iterators are active
   */
  function finalizeTableIterator() {
    iteratorResult.done = true
    if (--table.activeIteratorCount === 0) Lock.unlock(table.lock)
    return iteratorResult
  }

  function next() {
    // Clean up the iterator if it has already yielded the final index
    if (i === -1) return finalizeTableIterator()
    // Step forwards
    iteratorResult.value = i
    i--
    return iteratorResult
  }

  return initializeTableIterator
}
