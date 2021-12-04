import * as Lock from "./lock"

export declare class Opaque<$Value> {
  protected value: $Value
}

type Sparse<$Value> = $Value[]

/**
 * An entity identifier.
 */
export type Id<$Value = never> = number & Opaque<$Value>

/**
 * Extract the encoded value of an entity identifier.
 */
type ValueOf<$Id> = $Id extends Id<infer _> ? _ : never

/**
 * A type signature that characterizes an entity.
 */
export type Type = Id[]

/**
 * A densely packed vector of entity data.
 */
type Column = unknown[]

/**
 * A table of entity data for entityIndex of a specific type. Linked by an
 * adjacency index to other tableIndex.
 */
type Table = {
  type: Type
  columns: Column[]
}

/**
 * The root object of a Harmony world.
 */
export type Registry = {
  entityMax: number
  entityHead: Uint32Array
  entityIndex: Uint32Array
  entityPositionIndex: Uint32Array
  entityGenerationIndex: Uint16Array
  tableIndex: Sparse<Table>
  lock: Lock.Struct
}

function assert(condition: boolean): asserts condition {
  if (condition === false) {
    throw new Error()
  }
}

const FNV1_32A_INIT = 0x811c9dc5

function makeTypeHash(type: Type) {
  let h = FNV1_32A_INIT
  for (let i = 0; i < type.length; i++) {
    h ^= type[i]
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  return h >>> 0
}

function pack(lo: number, hi: number) {
  return (hi & 0x3fffff) * 0x40000000 + (lo & 0x3fffffff)
}

function lo(n: number) {
  return n & 0x3fffffff
}

function hi(n: number) {
  return (n - (n & 0x3fffffff)) / 0x40000000
}

function findOrMakeTable(tableIndex: Sparse<Table>, type: Type) {
  let typeHash = makeTypeHash(type)
  let table = tableIndex[typeHash]
  if (table === undefined) {
    table = makeTable(type)
    tableIndex[typeHash] = table
  }
  return table
}

function makeTable(type: Type): Table {
  return {
    type,
    columns: [],
  }
}

export function makeRegistry(entityMax: number): Registry {
  return {
    entityMax,
    entityHead: new Uint32Array(1),
    entityIndex: new Uint32Array(entityMax),
    entityPositionIndex: new Uint32Array(entityMax),
    entityGenerationIndex: new Uint16Array(entityMax),
    tableIndex: [],
    lock: Lock.make(new SharedArrayBuffer(entityMax * Uint32Array.BYTES_PER_ELEMENT)),
  }
}

export async function make(registry: Registry) {
  let eid = Atomics.add(registry.entityHead, 0, 1) + 1
  let gen = Atomics.load(registry.entityGenerationIndex, eid)
  assert(eid <= registry.entityMax)
  return pack(eid, gen) as Id
}

function genEq(registry: Registry, eid: number, gen: number) {
  return gen === Atomics.load(registry.entityGenerationIndex, eid)
}

export function isAlive(registry: Registry, id: Id) {
  return genEq(registry, lo(id), hi(id))
}

export async function add<$Value>(
  registry: Registry,
  id: Id,
  component: Id<$Value>,
  value?: $Value,
) {
  let eid = lo(id)
  let gen = hi(id)

  await Lock.lockThreadAware(registry.lock, eid)

  if (genEq(registry, eid, gen)) {
    let typeHash = registry.entityIndex[eid]
    let table = registry.tableIndex[typeHash]

    if (table !== undefined) {
      for (let i = 0; i < table.type.length; i++) {
        if (table.type[i] === component) return
      }
    }

    let nextType = table ? typeAdd(table.type, component as Id, []) : [component as Id]
    let nextTable = findOrMakeTable(registry.tableIndex, nextType)
    let nextTableHash = makeTypeHash(nextTable.type)

    registry.entityIndex[eid] = nextTableHash
    registry.entityPositionIndex[eid] = tableInsert(nextTable, component, value)
  }

  Lock.unlock(registry.lock)
}

export async function has(registry: Registry, id: Id, type: Type) {
  let eid = lo(id)
  if (!isAlive(registry, id)) {
    return false
  }
  await Lock.lockThreadAware(registry.lock, eid)
  let typeHash = registry.entityIndex[eid]
  let table = registry.tableIndex[typeHash]
  // todo: optimize
  let result = type.every(id => table.type.includes(id))
  Lock.unlock(registry.lock)
  return result
}

export async function destroy(registry: Registry, id: Id) {
  let eid = lo(id)
  let gen = hi(id)

  await Lock.lockThreadAware(registry.lock, eid)

  if (gen === registry.entityGenerationIndex[eid]) {
    registry.entityGenerationIndex[eid] = 1
  }

  Lock.unlock(registry.lock)
}

export function typeAdd(type: Type, add: Id, out: Type): Type {
  let added = false

  for (let i = 0; i < type.length; i++) {
    let id = type[i]
    if (id >= add && !added) {
      if (id !== add) out.push(add)
      added = true
    }
    out.push(id)
  }

  if (!added) out.push(add)

  return out
}

function tableInsert<$Value>(
  table: Table,
  component: Id<$Value>,
  value: unknown,
): number {
  return 999
}
