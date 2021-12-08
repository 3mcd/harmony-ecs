import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Type from "./type"
import * as Types from "./types"
import * as Signal from "./signal"

export type Signals = {
  onTableGrow: Signal.Struct<Struct>
}

export type Layout = (Schema.Struct | null)[]

/**
 * A densely packed vector of component data.
 */
type Column = unknown[] | Types.TypedArray | { [key: string]: Types.TypedArray }

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
      return Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        a[memberName] = makeTypedArrayColumn(memberNode, size)
        return a
      }, {} as { [key: string]: Types.TypedArray }) as Column
    case Schema.Type.Object:
      return [] as Column
    case Schema.Type.Scalar:
      return makeTypedArrayColumn(schema.shape, size) as Column
  }
}

/**
 * A table of entity data for entities of a specific type.
 */
export type Struct<T extends Type.Struct = Type.Struct> = {
  columns: (Column | null | undefined)[]
  entities: Uint32Array
  grow: number
  activeIteratorCount: number
  layout: Layout
  length: Uint32Array
  lock: Lock.Struct
  type: T
}

/**
 * Make a table.
 */
export function make<T extends Type.Struct>(
  type: T,
  layout: Layout,
  initSize: number,
  initGrow = 0.2,
): Struct<T> {
  let sharedEntities = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * initSize)
  let sharedLength = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let sharedLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let columns: (Column | null | undefined)[] = []

  for (let i = 0; i < type.length; i++) {
    let schema = layout[i]
    columns[type[i]] = schema ? makeColumn(schema, initSize) : null
  }

  return {
    columns,
    entities: new Uint32Array(sharedEntities),
    activeIteratorCount: 0,
    layout,
    length: new Uint32Array(sharedLength),
    lock: Lock.make(sharedLock),
    grow: initGrow,
    type,
  }
}

export function growArrayBufferUnsafe(array: Types.TypedArray, amount: number) {
  let size = array.byteLength + amount * array.BYTES_PER_ELEMENT
  let next = new SharedArrayBuffer(size)
  new Uint8Array(next).set(new Uint8Array(array.buffer))
  return next
}

export function growUnsafe(table: Struct) {
  let amount = Math.ceil(table.grow * table.length[0])

  table.entities = new Uint32Array(growArrayBufferUnsafe(table.entities, amount))

  for (let i = 0; i < table.type.length; i++) {
    let schema = table.layout[i]
    // Skip data-less components and native object arrays
    if (schema === null || schema.type === Schema.Type.Object) continue
    let id = table.type[i]
    let column = table.columns[id]
    if (schema.type === Schema.Type.Scalar) {
      table.columns[id] = new schema.shape.binary(
        growArrayBufferUnsafe(column as Types.TypedArray, amount),
      )
    } else {
      // Resize each member in the binary struct
      for (let prop in schema.shape) {
        ;(column as { [key: string]: Types.TypedArray })[prop] = new schema.shape[
          prop
        ].binary(growArrayBufferUnsafe(column as Types.TypedArray, amount))
      }
    }
  }

  table.grow *= 1.2
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
      for (let prop in schema.shape) {
        ;(column as { [key: string]: Types.TypedArray })[prop][index] = data[i]![prop]
      }
    } else {
      // "push" the scalar or object value into the target array
      ;(column as unknown[])[index] = data[i]
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

  return async function run() {
    await initializeTableIterator()
    return iterable
  }
}
