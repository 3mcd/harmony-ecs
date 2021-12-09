import * as Registry from "./registry"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Type from "./type"
import * as Types from "./types"
import * as Signal from "./signal"
import * as ComponentSet from "./component_set"
import * as SharedUintMap from "./shared_uint_map"

export type Signals = {
  onTableGrow: Signal.Struct<Struct>
}

export type Layout = (Schema.Struct | null)[]

type ColumnBinary = { [key: string]: Types.TypedArray }
type ColumnObject = unknown[]
type ColumnScalar = Types.TypedArray

/**
 * A densely packed vector of component data.
 */
type Column = ColumnObject | ColumnScalar | ColumnBinary

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

  /**
   *
   */
  version: number
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
      return Object.entries(schema.shape).reduce<ColumnBinary>(
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

export function writeColumnData<S extends Schema.Struct>(
  column: Column,
  schema: Schema.Struct,
  index: number,
  data: Schema.Express<S>,
) {
  if (schema.type === Schema.Type.Binary) {
    for (let i = 0; i < schema.keys.length; i++) {
      let key = schema.keys[i]
      ;(column as ColumnBinary)[key][index] = (
        data as Schema.Express<Schema.StructObject>
      )[key]
    }
  } else {
    ;(column as unknown[])[index] = data
  }
}

export function copyColumnData(
  prevColumn: Column,
  nextColumn: Column,
  schema: Schema.Struct,
  prevIndex: number,
  nextIndex: number,
) {
  if (schema.type === Schema.Type.Binary) {
    for (let i = 0; i < schema.keys.length; i++) {
      let key = schema.keys[i]
      let prevArray = (prevColumn as ColumnBinary)[key]
      let nextArray = (prevColumn as ColumnBinary)[key]
      nextArray[nextIndex] = prevArray[prevIndex]
    }
  } else {
    ;(nextColumn as unknown[])[nextIndex] = (prevColumn as unknown[])[prevIndex]
  }
}

function moveUnsafe(
  registry: Registry.Struct,
  entity: Entity.Id,
  prevIndex: number,
  prevTable: Struct,
  nextTable: Struct,
  data: ComponentSet.Struct,
  signals: Signals,
) {
  let nextIndex = nextTable.length[0]++

  // Grow the table if we have reached the a maximum size
  if (nextIndex === nextTable.entities.length) {
    growUnsafe(nextTable)
    Signal.dispatch(signals.onTableGrow, nextTable)
  }

  for (let i = 0; i < nextTable.type.length; i++) {
    let id = nextTable.type[i]
    let prevColumn = prevTable.columns[id]
    let nextColumn = nextTable.columns[id]
    // Skip data-less components
    if (nextColumn === null || nextColumn === undefined) continue
    let schema = nextTable.layout[i]!
    // Previous table doesn't have component, so there is no data to copy
    if (prevColumn === undefined) {
      let value = data[id] ?? Schema.express(nextTable.layout[i]!)
      writeColumnData(nextColumn, schema, nextIndex, value)
    } else {
      let value = data[id]
      if (value === undefined) {
        copyColumnData(prevColumn!, nextColumn, schema, prevIndex, nextIndex)
      } else {
        writeColumnData(nextColumn, schema, nextIndex, value!)
      }
    }
  }

  nextTable.entities[nextIndex] = entity
  removeUnsafe(registry, prevTable, entity)
  SharedUintMap.set(registry.entityOffsetIndex, entity, nextIndex)
}

function removeUnsafe(registry: Registry.Struct, table: Struct, index: number) {
  let head = table.length[0] - 1

  if (index === head) {
    // pop
    for (let i = 0; i < table.type.length; i++) {
      let id = table.type[i]
      let schema = table.layout[i]
      let column = table.columns[id]
      if (schema === null || schema === undefined) continue
      switch (schema.type) {
        case Schema.Type.Scalar:
          ;(column as ColumnScalar)[index] = 0
          break
        case Schema.Type.Binary:
          for (let j = 0; j < schema.keys.length; j++) {
            ;(column as ColumnBinary)[schema.keys[j]][index] = 0
          }
          break
        case Schema.Type.Object:
          ;(column as ColumnObject).pop()
          break
      }
    }
    table.entities[index] = 0
  } else {
    // swap
    for (let i = 0; i < table.type.length; i++) {
      let id = table.type[i]
      let schema = table.layout[i]
      let column = table.columns[id]
      if (schema === null || schema === undefined) continue
      switch (schema.type) {
        case Schema.Type.Scalar:
          let data = (column as ColumnScalar)[head]
          ;(column as ColumnScalar)[head] = 0
          ;(column as ColumnScalar)[index] = data
          break
        case Schema.Type.Binary:
          for (let j = 0; j < schema.keys.length; j++) {
            let key = schema.keys[j]
            let array = (column as ColumnBinary)[key]
            let data = array[head]
            array[head] = 0
            array[index] = data
          }
          break
        case Schema.Type.Object: {
          const data = (column as ColumnObject).pop()
          ;(column as ColumnObject)[index] = data
          break
        }
      }
    }
    let headEntity = table.entities[head]
    SharedUintMap.set(registry.entityOffsetIndex, headEntity, index)
    table.entities[index] = headEntity
    table.entities[head] = 0
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
        ;(column as ColumnBinary)[prop] = new schema.shape[prop].binary(
          growArrayBufferUnsafe(column as Types.TypedArray, size),
        )
      }
    }
  }

  table.scaleFactor *= 1.2
  table.version++
}

export function insertUnsafe<T extends Type.Struct>(
  registry: Registry.Struct,
  table: Struct<T>,
  entity: Entity.Id,
  data: ComponentSet.Struct,
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
        ;(column as ColumnBinary)[key][index] = (
          data[id] as Schema.Express<Schema.StructBinary>
        )[key]
      }
    } else {
      // push the scalar or object value into the target array
      ;(column as ColumnObject)[index] = data[i]
    }
  }

  SharedUintMap.set(registry.entityOffsetIndex, entity, index)
}

export async function insert<T extends Type.Struct>(
  registry: Registry.Struct,
  entity: Entity.Id,
  table: Struct<T>,
  data: ComponentSet.Struct,
  signals: Signals,
) {
  if (table.activeIteratorCount > 0) {
    // The thread already has a lock on the table within an iterator, so we
    // continue the insert without acquiring a lock
    insertUnsafe(registry, table, entity, data, signals)
  } else {
    // Function was not called within an iterator, so we must acquire a lock
    // before mutating the table
    await Lock.lockThreadAware(table.lock)
    insertUnsafe(registry, table, entity, data, signals)
    Lock.unlock(table.lock)
  }
}

export async function remove<T extends Type.Struct>(
  registry: Registry.Struct,
  table: Struct<T>,
  entity: Entity.Id,
) {
  if (table.activeIteratorCount > 0) {
    removeUnsafe(registry, table, entity)
  } else {
    await Lock.lockThreadAware(table.lock)
    removeUnsafe(registry, table, entity)
    Lock.unlock(table.lock)
  }
}

export async function move<T extends Type.Struct>(
  registry: Registry.Struct,
  entity: Entity.Id,
  index: number,
  prevTable: Struct<T>,
  nextTable: Struct<T>,
  data: ComponentSet.Struct,
  signals: Signals,
) {
  let state = 0
  if (prevTable.activeIteratorCount + nextTable.activeIteratorCount === 0) {
    await Promise.all([
      Lock.lockThreadAware(prevTable.lock),
      Lock.lockThreadAware(nextTable.lock),
    ])
    state = 3
  } else if (prevTable.activeIteratorCount === 0) {
    await Lock.lockThreadAware(prevTable.lock)
    state = 1
  } else if (nextTable.activeIteratorCount === 0) {
    await Lock.lockThreadAware(nextTable.lock)
    state = 2
  }

  moveUnsafe(registry, entity, index, prevTable, nextTable, data, signals)

  switch (state) {
    case 0:
      return
    case 1:
      Lock.unlock(prevTable.lock)
      break
    case 2:
      Lock.unlock(nextTable.lock)
      break
    case 3:
      Lock.unlock(prevTable.lock)
      Lock.unlock(nextTable.lock)
      break
  }
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
    version: 0,
  }
}
