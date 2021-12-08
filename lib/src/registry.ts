import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Table from "./table"
import * as Type from "./type"
import * as Signal from "./signal"

const performance = globalThis.performance ?? require("perf_hooks").performance

const ENTITY_FREE = 0
const ENTITY_RESERVED = 1

export type Signals = {
  onTableCreate: Signal.Struct<Table.Struct>
} & Table.Signals

/**
 * The root object of a Harmony world.
 */
export type Struct = {
  /**
   * Maps entities to their current generation. A generation is an integer
   * assigned to an entity that is incremented each time the entity is
   * destroyed. Generations are encoded as the high 20 bits of an entity
   * identifier. This lets Harmony recycle entity identifiers by invalidating
   * existing ones when the entity is destroyed.
   */
  entityGenerationIndex: Uint32Array

  /**
   * The next entity to attempt to reserve when creating a new entity.
   */
  entityHead: Uint32Array

  /**
   * A lock used to temporarily reserve access to entity-specific state to the
   * current thread. Affects the entity generation, entity type, and entity
   * offset indexes.
   */
  entityLock: Lock.Struct

  /**
   * The initial number of entities supported by the registry.
   */
  entityInit: number

  /**
   * Maps entities to the offset of their data within their current table.
   * Entity offsets are stored in this single, shared array as opposed to
   * unique arrays per-table to save memory and simplify parallelism.
   */
  entityOffsetIndex: Float64Array

  /**
   * Maps entities to a hash of their current type. Used to quickly look up an
   * entity's table.
   */
  entityTypeIndex: Float64Array

  /**
   * Maps identifiers to component shapes.
   */
  shapeIndex: Schema.Struct[]

  /**
   * Maps type hashes to a bit that signifies whether or not a table exists
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
}

export function make(entityInit = 1_000): Struct {
  // create shared memory
  let sharedEntityGenerationIndex = new SharedArrayBuffer(
    entityInit * Uint32Array.BYTES_PER_ELEMENT,
  )
  let sharedEntityHead = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  let sharedEntityLock = new SharedArrayBuffer(entityInit * Uint32Array.BYTES_PER_ELEMENT)
  let sharedEntityTypeIndex = new SharedArrayBuffer(
    entityInit * Float64Array.BYTES_PER_ELEMENT,
  )
  let sharedEntityOffsetIndex = new SharedArrayBuffer(
    entityInit * Float64Array.BYTES_PER_ELEMENT,
  )
  let sharedTableCheck = new SharedArrayBuffer(0xffffffff / 8)
  let sharedTableLock = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)
  // create and initialize locks
  let entityLock = Lock.make(sharedEntityLock)
  let tableLock = Lock.make(sharedTableLock)
  Lock.initialize(sharedEntityLock, 0)
  Lock.initialize(sharedTableLock, 0)

  return {
    entityGenerationIndex: new Uint32Array(sharedEntityGenerationIndex),
    entityHead: new Uint32Array(sharedEntityHead),
    entityLock,
    entityInit,
    entityTypeIndex: new Float64Array(sharedEntityTypeIndex),
    entityOffsetIndex: new Float64Array(sharedEntityOffsetIndex),
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
async function findOrMakeTable<T extends Type.Struct>(
  registry: Struct,
  type: T,
  typeHash: number,
  signals: Signals,
) {
  Lock.lockThreadAware(registry.tableLock)
  let table = registry.tableIndex[typeHash]

  if (table === undefined) {
    let tableCheckIndex = calcTableCheckIndex(typeHash)
    let tableCheckMask = calcTableCheckMask(typeHash)
    if ((registry.tableCheck[tableCheckIndex] & tableCheckMask) !== 0) {
      table = await waitForTable(registry, typeHash)
    } else {
      table = Table.make(
        type,
        type.map(id => registry.shapeIndex[id] ?? null),
        registry.entityInit,
      )
      registry.tableCheck[tableCheckIndex] |= tableCheckMask
      registry.tableIndex[typeHash] = table
      Signal.dispatch(signals.onTableCreate, table)
    }
  }

  Lock.unlock(registry.tableLock)

  return table
}

/**
 * Make an entity.
 */
export async function makeEntity<D>(registry: Struct) {
  let id: Entity.Id | undefined
  // Not sure if this is thread-safe. May need to place a lock on the entire
  // registry
  for (let i = 0; i < registry.entityInit; i++) {
    // uint32 will wrap around to 0 after the maximum 32-bit integer value is
    // surpassed
    let entityId = Atomics.add(registry.entityHead, 0, 1) + 1
    // Lock the entity state while we check if it's free
    await Lock.lockThreadAware(registry.entityLock, entityId)
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

  return id as Entity.Id<D>
}

function ofGeneration(registry: Struct, entityId: number, entityGen: number) {
  return entityGen === Atomics.load(registry.entityGenerationIndex, entityId)
}

function isPrimitive(typeHash: number) {
  return typeHash === ENTITY_FREE || typeHash === ENTITY_RESERVED
}

export function isAlive(registry: Struct, id: Entity.Id) {
  return ofGeneration(registry, Entity.lo(id), Entity.hi(id))
}

export async function has(registry: Struct, entity: Entity.Id, type: Type.Struct) {
  let entityId = Entity.lo(entity)
  let entityGen = Entity.hi(entity)
  let normalType = Type.normalize(type)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let match = false

  if (!isPrimitive(typeHash)) {
    let table = await findOrWaitForTable(registry, typeHash)
    match = Type.contains(table.type, normalType) || Type.isEqual(table.type, normalType)
  }

  Lock.unlock(registry.entityLock)

  return match
}

export async function add<T extends Type.Struct>(
  registry: Struct,
  entity: Entity.Id,
  type: T,
  data: Table.Row<T>,
  signals: Signals,
) {
  let entityId = Entity.lo(entity)
  let entityGen = Entity.hi(entity)
  let normalType = Type.normalize(type)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let typeHash = registry.entityTypeIndex[entityId]
  let table: Table.Struct | undefined

  if (!isPrimitive(typeHash)) {
    table = await findOrWaitForTable(registry, typeHash)
  }

  let nextType: Type.Struct

  if (table) {
    if (Type.contains(table.type, normalType)) {
      // No-op: entity already has all of these components
      return
    }
    // Merge the two types
    nextType = Type.and(table.type, normalType)
  } else {
    nextType = type
  }

  let nextHash = Type.hash(nextType)
  let nextTable = await findOrMakeTable(registry, nextType, nextHash, signals)

  // TODO: move from prev table to next
  registry.entityOffsetIndex[entityId] = await Table.insert(
    nextTable,
    entity,
    data,
    signals,
  )
  registry.entityTypeIndex[entityId] = nextHash

  Lock.unlock(registry.entityLock)
}

export async function remove(
  registry: Struct,
  id: Entity.Id,
  component: Entity.Id<Schema.Struct>,
  signals: Signals,
) {
  // let entityId = Entity.lo(id)
  // let entityGen = Entity.hi(id)
  // await Lock.lockThreadAware(registry.entityLock, entityId)
  // Debug.assert(ofGeneration(registry, entityId, entityGen))
  // let typeHash = registry.entityTypeIndex[entityId]
  // let table = await findOrWaitForTable(registry, typeHash)
  // if (table === undefined || !table.type.includes(id)) {
  //   return
  // }
  // let nextType = Type.remove(table.type, component)
  // let nextHash = Type.hash(nextType)
  // let nextTable = await findOrMakeTable(registry, nextType, nextHash, out)
  // Lock.unlock(registry.entityLock)
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

export function makeSchema<S extends Schema.ObjectShape>(
  registry: Struct,
  shape: S,
  type?: Schema.Type.Binary,
): Promise<Entity.Id<Schema.StructBinary<S>>>
export function makeSchema<S extends Schema.ObjectShape>(
  registry: Struct,
  shape: S,
  type: Schema.Type.Object,
): Promise<Entity.Id<Schema.StructObject<S>>>
export function makeSchema<S extends Schema.ScalarShape>(
  registry: Struct,
  shape: S,
): Promise<Entity.Id<Schema.StructScalar<S>>>
export async function makeSchema<S extends Schema.Shape>(
  registry: Struct,
  shape: S,
  type?: Schema.Type,
) {
  let schema: Schema.Struct
  if (Format.isFormat(shape)) {
    schema = { type: Schema.Type.Scalar, shape }
  } else if (type === Schema.Type.Object) {
    schema = { type: Schema.Type.Object, shape }
  } else {
    schema = { type: Schema.Type.Binary, shape, keys: Object.keys(shape) }
  }
  let entity = await makeEntity<S>(registry)
  registry.shapeIndex[entity] = schema
  return entity
}
