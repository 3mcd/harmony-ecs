import * as Lock from "./lock"
import * as Debug from "./debug"
import * as Signal from "./signal"

export declare class Opaque<$Data> {
  protected value: $Data
}

export type Sparse<$Data> = $Data[]

/**
 * An entity identifier.
 */
export type Id<$Data = unknown> = number & Opaque<$Data>

/**
 * Extract the encoded value of an entity identifier.
 */
export type Data<$Id> = $Id extends Id<infer _> ? _ : never

/**
 * A type signature that characterizes an entity.
 */
export type Type = Id[]

/**
 * A densely packed vector of entity data.
 */
export type Column = unknown[]

/**
 * A table of entity data for entityIndex of a specific type. Linked by an
 * adjacency index to other tableIndex.
 */
export type Table = {
  type: Type
  columns: Column[]
}

/**
 * The root object of a Harmony world.
 */
export type Registry = {
  entityMax: number
  entityHead: Uint32Array
  entityLocationIndex: Uint32Array
  entityPositionIndex: Uint32Array
  entityGenIndex: Uint16Array
  lock: Lock.Struct
  tableIndex: Sparse<Table>
}

export type Signals = {
  onTableAdd: Signal.Struct<Table>
}

const FNV1_32A_INIT = 0x811c9dc5

export function makeTypeHash(type: Type) {
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

function findOrMakeTable(registry: Registry, type: Type, signals?: Signals) {
  let typeHash = makeTypeHash(type)
  let table = registry.tableIndex[typeHash]
  if (table === undefined) {
    table = makeTable(type)
    registry.tableIndex[typeHash] = table
    if (signals !== undefined) {
      Signal.dispatch(signals.onTableAdd, table)
    }
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
  // initialize shared memory
  const sharedEntityHead = new SharedArrayBuffer(4)
  const sharedEntityIndex = new SharedArrayBuffer(
    entityMax * Uint32Array.BYTES_PER_ELEMENT,
  )
  const sharedEntityLocIndex = new SharedArrayBuffer(
    entityMax * Uint32Array.BYTES_PER_ELEMENT,
  )
  const sharedEntityGenIndex = new SharedArrayBuffer(
    entityMax * Uint16Array.BYTES_PER_ELEMENT,
  )
  const sharedLock = new SharedArrayBuffer(entityMax * Uint32Array.BYTES_PER_ELEMENT)

  // initialize lock
  const lock = Lock.make(sharedLock)
  Lock.initialize(sharedLock, 0)

  return {
    entityGenIndex: new Uint16Array(sharedEntityGenIndex),
    entityHead: new Uint32Array(sharedEntityHead),
    entityLocationIndex: new Uint32Array(sharedEntityIndex),
    entityPositionIndex: new Uint32Array(sharedEntityLocIndex),
    entityMax,
    lock,
    tableIndex: [],
  }
}

/**
 * Make an entity.
 */
export async function make(registry: Registry) {
  // Not sure if this is thread-safe. May need to place a lock on the entire
  // entity index
  for (let i = 0; i < registry.entityMax; i++) {
    // Incrementing the uint32 will wrap around to 0 once we hit the maximum
    // 32-bit integer value
    let eid = Atomics.add(registry.entityHead, 0, 1) + 1
    let loc = Atomics.load(registry.entityLocationIndex, eid)
    if (loc === 0) {
      // Reserve id
      Atomics.store(registry.entityLocationIndex, eid, 1)
      return pack(eid, Atomics.load(registry.entityGenIndex, eid)) as Id
    }
  }

  throw new Error("Failed to create entity: all entity identifiers are in use")
}

function genEq(registry: Registry, eid: number, gen: number) {
  return gen === Atomics.load(registry.entityGenIndex, eid)
}

export function isAlive(registry: Registry, id: Id) {
  return genEq(registry, lo(id), hi(id))
}

export async function add<$Data>(
  registry: Registry,
  id: Id,
  component: Id<$Data>,
  value?: $Data,
  signals?: Signals,
) {
  Debug.assert(isAlive(registry, id))

  let eid = lo(id)
  let gen = hi(id)

  await Lock.lockThreadAware(registry.lock, eid)

  if (genEq(registry, eid, gen)) {
    let typeHash = registry.entityLocationIndex[eid]
    let table = registry.tableIndex[typeHash]

    if (table !== undefined) {
      for (let i = 0; i < table.type.length; i++) {
        if (table.type[i] === component) return
      }
    }

    let nextType = table ? typeAdd(table.type, component, []) : [component]
    let nextTypeHash = makeTypeHash(nextType)
    let nextTable = findOrMakeTable(registry, nextType, signals)

    registry.entityLocationIndex[eid] = nextTypeHash
    registry.entityPositionIndex[eid] = tableInsert(nextTable, component, value)
  }

  Lock.unlock(registry.lock)
}

export async function has(registry: Registry, id: Id, type: Type) {
  Debug.assert(isAlive(registry, id))

  let eid = lo(id)

  await Lock.lockThreadAware(registry.lock, eid)

  let typeHash = registry.entityLocationIndex[eid]
  let table = registry.tableIndex[typeHash]
  let result = type.every(id => table.type.includes(id))

  Lock.unlock(registry.lock)

  return result
}

export async function destroy(registry: Registry, id: Id) {
  Debug.assert(isAlive(registry, id))

  let eid = lo(id)
  let gen = hi(id)

  await Lock.lockThreadAware(registry.lock, eid)

  if (gen === registry.entityGenIndex[eid]) {
    registry.entityGenIndex[eid] += 1
    registry.entityPositionIndex[eid] = 0
    registry.entityLocationIndex[eid] = 0
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

function tableInsert<$Data>(table: Table, component: Id<$Data>, value: unknown): number {
  return 999
}
