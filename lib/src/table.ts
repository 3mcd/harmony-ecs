import * as Debug from "./debug"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Shape from "./shape"
import * as Types from "./types"
import * as Entity from "./entity"

type TableType = Entity.Id<Shape.Struct>[]
type TableShape<$Type extends TableType> = {
  [K in keyof $Type]: Entity.Data<$Type[K]>
}

/**
 * A densely packed vector of component data.
 */
type Column<$Type extends Shape.Struct> = Types.Construct<$Type["binary"]>

/**
 * A type mapped to an array of columns.
 */
export type Columns<$Type extends TableType> = {
  [K in keyof $Type]: Entity.Data<$Type[K]> extends Shape.Struct
    ? Column<Entity.Data<$Type[K]>>
    : never
}

/**
 * A row of table data associated with a single entity.
 */
export type Row<$Type extends TableType> = {
  [K in keyof $Type]: number
}

/**
 * Make a table column.
 */
function makeColumn<$Format extends Format.Struct>(
  schema: $Format,
  size: number,
): Column<$Format> {
  return new schema.binary(size) as Column<$Format>
}

/**
 * A table of entity data for entities of a specific type.
 */
export type Struct<$Type extends TableType = TableType> = {
  columns: Columns<$Type>
  length: Uint32Array
  type: $Type
  shape: TableShape<$Type>
  lock: Lock.Struct
}

/**
 * Make a table.
 */
export function make<$Type extends TableType>(
  type: $Type,
  size: number,
  shape: TableShape<$Type>,
): Struct<$Type> {
  let sharedLength = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let sharedLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  return {
    columns: type.map((_, i) => makeColumn(shape[i], size)) as Columns<$Type>,
    length: new Uint32Array(sharedLength),
    type,
    shape,
    lock: Lock.make(sharedLock),
  }
}

export async function insert<$Type extends TableType>(
  table: Struct<$Type>,
  data: Row<$Type>,
) {
  await Lock.lockThreadAware(table.lock)
  let index = table.length[0]++
  for (let i = 0; i < table.columns.length; i++) {
    // @ts-ignore
    table.columns[i][index] = data[i]
  }
  Lock.unlock(table.lock)
  return index
}

export async function remove<$Type extends TableType>(
  table: Struct<$Type>,
  index: number,
) {
  await Lock.lockThreadAware(table.lock)
  Debug.invariant(index < table.length[0])
  // for (let i = 0; i < table.columns.length; i++) {
  //   // @ts-ignore
  //   table.columns[i].array[index] = data[i]
  // }
  Lock.unlock(table.lock)
}

export function iter<$Type extends TableType>(table: Struct<$Type>) {
  let i = 0
  let iterator: Iterator<number> = { next }
  let iteratorResult: IteratorResult<number> = {
    value: 0,
    done: false,
  }

  function next() {
    if (i === -1) {
      iteratorResult.done = true
    } else {
      i--
    }
    iteratorResult.value = i

    return iteratorResult
  }

  return {
    [Symbol.iterator]() {
      i = table.length[0] - 1
      iteratorResult.done = false
      return iterator
    },
  }
}
