import * as Debug from "./debug"
import * as Lock from "./lock"

let performance =
  "performance" in globalThis
    ? globalThis.performance
    : (await import("perf_hooks")).performance

export declare class Opaque<$Data> {
  protected value: $Data
}

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
 * A table of entity data for entities of a specific type.
 */
export type Table = {
  type: Type
  columns: Column[]
}

/**
 * The root object of a Harmony world.
 */
export type Registry = {
  /**
   * Maps entities to their current generation. A generation is an integer that
   * is incremented each time the entity is destroyed. Generations are encoded
   * as the high 20 bits of an entity identifier. This lets Harmony recycle
   * identifiers by invalidating existing ones when the entity is destroyed.
   */
  entityGenerationIndex: Uint16Array
  /**
   * The next entity to attempt to reserve when creating a new entity.
   */
  entityHead: Uint32Array
  /**
   * Maps entities to a unique hash of their type. Used to quickly look up an
   * entity's table.
   */
  entityTypeIndex: Uint32Array
  /**
   * A lock used to temporarily reserve access to entity-specific state to the
   * current thread. Specifically targets the entity generation, position, and
   * type indexes.
   */
  entityLock: Lock.Struct
  /**
   * The maximum number of entities supported by the registry.
   */
  entityMax: number
  /**
   * Maps entities to their offset within their current table.
   */
  entityPositionIndex: Uint32Array
  /**
   * Maps unique type hashes to a bit which signifies whether or not a table
   * exists for that type.
   */
  tableCheck: Uint8Array
  /**
   * A sparse array which maps type hashes to an entity table.
   */
  tableIndex: Table[]
  /**
   * A lock used to temporarily reserve access to the creation of new tables.
   */
  tableLock: Lock.Struct
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

function calcTableCheckIndex(typeHash: number) {
  return Math.floor(typeHash / 8)
}

function calcTableCheckMask(typeHash: number) {
  return 1 << typeHash % 8
}

async function findOrWaitForTable(registry: Registry, typeHash: number) {
  let table = registry.tableIndex[typeHash]
  if (table === undefined) {
    let tableCheckIndex = calcTableCheckIndex(typeHash)
    let tableCheckMask = calcTableCheckMask(typeHash)
    if ((registry.tableCheck[tableCheckIndex] & tableCheckMask) !== 0) {
      table = await waitForTable(registry, typeHash)
    }
  }
  return table
}

/**
 * Locate or create a table in a thread-safe manner.
 */
async function findOrMakeTable(registry: Registry, type: Type, createdTables: Table[]) {
  Lock.lockThreadAware(registry.tableLock)

  let typeHash = makeTypeHash(type)
  let table = registry.tableIndex[typeHash]

  if (table === undefined) {
    let tableCheckIndex = calcTableCheckIndex(typeHash)
    let tableCheckMask = calcTableCheckMask(typeHash)
    if ((registry.tableCheck[tableCheckIndex] & tableCheckMask) !== 0) {
      table = await waitForTable(registry, typeHash)
    } else {
      table = makeTable(type)
      registry.tableCheck[tableCheckIndex] |= tableCheckMask
      registry.tableIndex[typeHash] = table
      createdTables.push(table)
    }
  }

  Lock.unlock(registry.tableLock)

  return table
}

/**
 * Await a table created in a different thread.
 */
function waitForTable(registry: Registry, typeHash: number, timeout = 1000) {
  let table = registry.tableIndex[typeHash]

  if (table) {
    return table
  }

  let startTime = performance.now()

  return new Promise<Table>(function checkTableExecutor(resolve, reject) {
    function checkTableReceived() {
      let table = registry.tableIndex[typeHash]
      if (table !== undefined) {
        resolve(table)
      } else {
        if (startTime - performance.now() > timeout) {
          reject()
        } else {
          setImmediate(checkTableReceived)
        }
      }
    }
    checkTableReceived()
  })
}

function makeTable(type: Type): Table {
  return {
    type,
    columns: [],
  }
}

export function makeRegistry(entityMax: number): Registry {
  let size32 = entityMax * Uint32Array.BYTES_PER_ELEMENT
  let size16 = entityMax * Uint16Array.BYTES_PER_ELEMENT
  // initialize shared memory
  let memEntityGenerationIndex = new SharedArrayBuffer(size16)
  let memEntityHead = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let memEntityIndex = new SharedArrayBuffer(size32)
  let memEntityLock = new SharedArrayBuffer(size32)
  let memEntityPositionIndex = new SharedArrayBuffer(size32)
  let memTableCheck = new SharedArrayBuffer(0xffffffff / 8)
  let memTableLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  // initialize locks
  let entityLock = Lock.make(memEntityLock)
  let tableLock = Lock.make(memTableLock)
  Lock.initialize(memEntityLock, 0)
  Lock.initialize(memTableLock, 0)

  return {
    entityGenerationIndex: new Uint16Array(memEntityGenerationIndex),
    entityHead: new Uint32Array(memEntityHead),
    entityLock,
    entityMax,
    entityPositionIndex: new Uint32Array(memEntityPositionIndex),
    entityTypeIndex: new Uint32Array(memEntityIndex),
    tableCheck: new Uint8Array(memTableCheck),
    tableIndex: [],
    tableLock,
  }
}

const ENTITY_FREE = 0
const ENTITY_RESERVED = 1

/**
 * Make an entity.
 */
export async function make(registry: Registry) {
  let id: Id | undefined
  // Not sure if this is thread-safe. May need to place a lock on the entire
  // registry
  for (let i = 0; i < registry.entityMax; i++) {
    // Incrementing the uint32 will wrap around to 0 once we hit the maximum
    // 32-bit integer value
    let entityId = Atomics.add(registry.entityHead, 0, 1) + 1
    Lock.lockThreadAware(registry.entityLock, entityId)
    let entityTypeHash = registry.entityTypeIndex[entityId]
    let hit = entityTypeHash === ENTITY_FREE
    if (hit) {
      // Reserve id
      registry.entityTypeIndex[entityId] = ENTITY_RESERVED
      id = pack(entityId, registry.entityGenerationIndex[entityId]) as Id
    }
    Lock.unlock(registry.entityLock)
    if (hit) break
  }

  Debug.assert(
    id !== undefined,
    "Failed to create entity: all entity identifiers are in use",
  )

  return id
}

function ofGeneration(registry: Registry, entityId: number, entityGen: number) {
  return entityGen === Atomics.load(registry.entityGenerationIndex, entityId)
}

export function isAlive(registry: Registry, id: Id) {
  return ofGeneration(registry, lo(id), hi(id))
}

export async function add<$Data>(
  registry: Registry,
  id: Id,
  component: Id<$Data>,
  value: $Data,
  createdTables: Table[],
) {
  let entityId = lo(id)
  let entityGen = hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let table: Table | undefined

  // If the entity has a type (i.e. one or more components)
  if (typeHash !== ENTITY_RESERVED && typeHash !== ENTITY_FREE) {
    table = await findOrWaitForTable(registry, typeHash)
    for (let i = 0; i < table.type.length; i++) {
      if (table.type[i] === component) return
    }
  }

  let nextType = table ? typeAdd(table.type, component, []) : [component]
  let nextHash = makeTypeHash(nextType)
  let nextTable = await findOrMakeTable(registry, nextType, createdTables)

  registry.entityTypeIndex[entityId] = nextHash
  registry.entityPositionIndex[entityId] = tableInsert(nextTable, component, value)

  Lock.unlock(registry.entityLock)
}

export async function has(registry: Registry, id: Id, type: Type) {
  let entityId = lo(id)
  let entityGen = hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let table = await waitForTable(registry, typeHash)
  let result = type.every(id => table.type.includes(id))

  Lock.unlock(registry.entityLock)

  return result
}

export async function destroy(registry: Registry, id: Id) {
  let entityId = lo(id)
  let entityGen = hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  if (entityGen === registry.entityGenerationIndex[entityId]) {
    registry.entityGenerationIndex[entityId] += 1
    registry.entityPositionIndex[entityId] = 0
    registry.entityTypeIndex[entityId] = ENTITY_FREE
  }

  Lock.unlock(registry.entityLock)
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
