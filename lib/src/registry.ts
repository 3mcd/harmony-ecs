import * as Lock from "./lock"
import * as Table from "./table"
import * as Entity from "./entity"
import * as Type from "./type"
import * as Debug from "./debug"
import * as Shape from "./shape"

const ENTITY_FREE = 0
const ENTITY_RESERVED = 1

/**
 * The root object of a Harmony world.
 */
export type Struct = {
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
   * Maps entities to a hash of their current type. Used to quickly look up an
   * entity's table.
   */
  entityTypeIndex: Float64Array
  /**
   * A lock used to temporarily reserve access to entity-specific state to the
   * current thread. Affects the entity generation, position, and type indexes.
   */
  entityLock: Lock.Struct
  /**
   * The maximum number of entities supported by the registry.
   */
  entityMax: number
  /**
   * Maps type hashes to a bit which signifies whether or not a table exists
   * for that type. Used to inform other threads of the existence of a table
   * that hasn't been shared yet.
   */
  tableCheck: Uint8Array
  /**
   * Maps type hashes to an entity table.
   */
  tableIndex: Table.Struct[]
  /**
   * A lock used to temporarily reserve access to the creation of new tables.
   */
  tableLock: Lock.Struct

  shapeIndex: Shape.Struct[]
}

export function makeRegistry(entityMax: number): Struct {
  let size32 = entityMax * Uint32Array.BYTES_PER_ELEMENT
  let size16 = entityMax * Uint16Array.BYTES_PER_ELEMENT
  let size64 = entityMax * Float64Array.BYTES_PER_ELEMENT
  // initialize shared memory
  let sharedEntityGenerationIndex = new SharedArrayBuffer(size16)
  let sharedEntityHead = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let sharedEntityLock = new SharedArrayBuffer(size32)
  let sharedEntityTypeIndex = new SharedArrayBuffer(size64)
  let sharedTableCheck = new SharedArrayBuffer(0xffffffff / 8)
  let sharedTableLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  // initialize locks
  let entityLock = Lock.make(sharedEntityLock)
  let tableLock = Lock.make(sharedTableLock)
  Lock.initialize(sharedEntityLock, 0)
  Lock.initialize(sharedTableLock, 0)

  return {
    entityGenerationIndex: new Uint16Array(sharedEntityGenerationIndex),
    entityHead: new Uint32Array(sharedEntityHead),
    entityLock,
    entityMax,
    entityTypeIndex: new Float64Array(sharedEntityTypeIndex),
    tableCheck: new Uint8Array(sharedTableCheck),
    tableIndex: [],
    tableLock,
    shapeIndex: [],
  }
}

/**
 * Calculate the index in a table check array at which a table with the
 * specified hash would exist.
 */
function calcTableCheckIndex(typeHash: number) {
  return Math.floor(typeHash / 8)
}

/**
 * Calculate the mask used to read the specific bit for a table at an index in
 * a table check array.
 */
function calcTableCheckMask(typeHash: number) {
  return 1 << typeHash % 8
}

/**
 * Wait for a table to (magically) appear. Throw if a table doesn't show up
 * after the provided timeout.
 */
function waitForTable(registry: Struct, typeHash: number, timeout = 1000) {
  let table = registry.tableIndex[typeHash]
  if (table) return table

  let startTime = performance.now()

  return new Promise<Table.Struct>(function checkTableExecutor(resolve, reject) {
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

/**
 * Attempt to synchronously locate a table by type hash. Wait for the table if
 * it isn't found on the current thread, but definitely exists on another.
 */
async function findOrWaitForTable(registry: Struct, typeHash: number) {
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
async function findOrMakeTable(
  registry: Struct,
  type: Entity.Id<Shape.Struct>[],
  createdTables: Table.Struct[],
) {
  Lock.lockThreadAware(registry.tableLock)

  let typeHash = Type.hash(type)
  let table = registry.tableIndex[typeHash]

  if (table === undefined) {
    let tableCheckIndex = calcTableCheckIndex(typeHash)
    let tableCheckMask = calcTableCheckMask(typeHash)
    if ((registry.tableCheck[tableCheckIndex] & tableCheckMask) !== 0) {
      table = await waitForTable(registry, typeHash)
    } else {
      table = Table.make(type, registry.entityMax, type.map(id => registry.shapeIndex[id]))
      registry.tableCheck[tableCheckIndex] |= tableCheckMask
      registry.tableIndex[typeHash] = table
      createdTables.push(table)
    }
  }

  Lock.unlock(registry.tableLock)

  return table
}

/**
 * Make an entity.
 */
export async function make(registry: Struct) {
  let id: Entity.Id | undefined
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
      id = Entity.pack(entityId, registry.entityGenerationIndex[entityId]) as Entity.Id
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

function ofGeneration(registry: Struct, entityId: number, entityGen: number) {
  return entityGen === Atomics.load(registry.entityGenerationIndex, entityId)
}

export function isAlive(registry: Struct, id: Entity.Id) {
  return ofGeneration(registry, Entity.lo(id), Entity.hi(id))
}

export async function add(
  registry: Struct,
  id: Entity.Id,
  component: Entity.Id<Shape.Struct>,
  value: number,
  createdTables: Table.Struct[],
) {
  let entityId = Entity.lo(id)
  let entityGen = Entity.hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let table: Table.Struct | undefined

  // If the entity has a type (i.e. one or more components)
  if (typeHash !== ENTITY_RESERVED && typeHash !== ENTITY_FREE) {
    table = await findOrWaitForTable(registry, typeHash)
    for (let i = 0; i < table.type.length; i++) {
      if (table.type[i] === component) return
    }
  }

  let nextType = table ? Type.add(table.type, component) : [component]
  let nextHash = Type.hash(nextType)
  let nextTable = await findOrMakeTable(registry, nextType, createdTables)

  registry.entityTypeIndex[entityId] = nextHash
  Table.insert(nextTable, [id, value])

  Lock.unlock(registry.entityLock)
}

export async function has(registry: Struct, id: Entity.Id, type: Type.Struct) {
  let entityId = Entity.lo(id)
  let entityGen = Entity.hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let table = await waitForTable(registry, typeHash)
  let result = type.every(id => table.type.includes(id))

  Lock.unlock(registry.entityLock)

  return result
}

export async function destroy(registry: Struct, id: Entity.Id) {
  let entityId = Entity.lo(id)
  let entityGen = Entity.hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  if (entityGen === registry.entityGenerationIndex[entityId]) {
    registry.entityGenerationIndex[entityId] += 1
    registry.entityTypeIndex[entityId] = ENTITY_FREE
  }

  Lock.unlock(registry.entityLock)
}

export function