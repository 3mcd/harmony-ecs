import * as ComponentSet from "./component_set"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Table from "./table"
import * as SharedMap from "./shared_uint_map"
import * as SharedSparse from "./shared_sparse_set"
import * as Type from "./type"

const performance = globalThis.performance ?? require("perf_hooks").performance

/**
 * Signifies that an entity is available for use.
 */
const ENTITY_FREE = 0

/**
 * Signifies that an entity is not available for use but does not yet have any
 * components.
 */
const ENTITY_RESERVED = 1

export const OFFSET_ID = 4 * 0
export const OFFSET_LOCK = 4 * 1
export const OFFSET_GEN = 4 * 2
export const OFFSET_OFFSET = 4 * 3
export const OFFSET_TYPE = 4 * 4

export type Signals = Table.Signals & {
  onTableCreate: Signal.Struct<Table.Struct>
  onRegistryGrow: Signal.Struct<
    [entityIndex: SharedSparse.Struct, tableVersionIndex: SharedMap.Struct]
  >
}

/**
 * The root object of a Harmony world.
 */
export type Struct = {
  /**
   * @example
   */
  entityIndex: SharedSparse.Struct

  /**
   * The next entity to attempt to reserve when creating a new entity.
   */
  entityHead: Uint32Array

  /**
   * A lock used to temporarily reserve access to entity-specific state to the
   * current thread.
   */
  entityLock: Lock.Struct

  /**
   * The initial number of entities supported by the registry.
   */
  entityInit: number

  /**
   * Maps identifiers to component shapes.
   */
  schemaIndex: Schema.Struct[]

  /**
   * A set that contains type hashes for tables that exist on at least one
   * thread. Used to inform other threads of the existence of a table that
   * hasn't been shared yet.
   */
  tableVersionIndex: SharedMap.Struct

  /**
   * Maps type hashes to their table.
   */
  tableIndex: Table.Struct[]

  /**
   * A lock used to temporarily reserve access to the creation of new tables.
   */
  tableLock: Lock.Struct
}

export function getEntityLockIndex(entityIndex: SharedSparse.Struct, entityId: number) {
  return SharedSparse.getDenseOffset(entityIndex, entityId)! + 4
}

export function make(entityInit = 1_000): Struct {
  let entityIndex = SharedSparse.make(entityInit, 24)
  let entityLock = Lock.make(entityIndex.dense)
  let tableLock = Lock.make(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT))
  Lock.initialize(entityLock, 0)
  Lock.initialize(tableLock, 0)

  return {
    entityIndex,
    entityHead: new Uint32Array(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)),
    entityLock,
    entityInit,
    schemaIndex: [],
    tableVersionIndex: SharedMap.make(1_000),
    tableIndex: [],
    tableLock,
  }
}

/**
 * Wait for a table to (magically) appear. Throw if a table doesn't show up
 * after the provided timeout.
 */
function waitForTableUnsafe(
  registry: Struct,
  typeHash: number,
  tableVersion: number,
  timeout = 1000,
) {
  let startTime = performance.now()
  return new Promise<Table.Struct>(function checkTableExecutor(resolve, reject) {
    function checkTableReceived() {
      let table = registry.tableIndex[typeHash]
      if (table?.version === tableVersion) {
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
 * Resolves `null` if the table does not exist.
 */
async function findOrWaitForTableUnsafe(
  registry: Struct,
  typeHash: number,
): Promise<Table.Struct | null> {
  let table = registry.tableIndex[typeHash]
  let tableVersion = SharedMap.get(registry.tableVersionIndex, typeHash)
  if (table === undefined || table.version !== tableVersion) {
    table = await waitForTableUnsafe(registry, typeHash, tableVersion!)
  }
  return table ?? null
}

/**
 * Locate or create a table in a thread-safe manner.
 */
async function findOrMakeTableUnsafe<T extends Type.Struct>(
  registry: Struct,
  type: T,
  typeHash: number,
  signals: Signals,
) {
  let table = await findOrWaitForTableUnsafe(registry, typeHash)
  if (table === null) {
    table = Table.make(
      typeHash,
      type,
      type.map(id => registry.schemaIndex[id] ?? null),
      registry.entityInit,
    )
    SharedMap.set(registry.tableVersionIndex, typeHash)
    registry.tableIndex[typeHash] = table
    Signal.dispatch(signals.onTableCreate, table)
  }
  return table
}

/**
 * Make an entity.
 */
export async function makeEntity<D>(registry: Struct) {
  let id: Entity.Id | undefined

  for (let i = 0; i < registry.entityInit; i++) {
    let entityId = Atomics.add(registry.entityHead, 0, 1) + 1
    let entityState = SharedSparse.get(registry.entityIndex, entityId)
    let entityLockIndex = getEntityLockIndex(registry.entityIndex, entityId)
    // Lock the entity state while we check if it's free
    await Lock.lockThreadAware(registry.entityLock, entityLockIndex)
    // Check if entity is available
    let entityTypeHash = entityState.getFloat64(OFFSET_TYPE)
    let hit = entityTypeHash === undefined || entityTypeHash === ENTITY_FREE
    if (hit) {
      // Entity is available—reserve the id
      entityState.setFloat64(OFFSET_TYPE, ENTITY_RESERVED)
      id = Entity.pack(entityId, entityState.getUint32(OFFSET_GEN)) as Entity.Id
    }
    Lock.unlock(registry.entityLock, entityLockIndex)
    if (hit) break
  }

  Debug.assert(
    id !== undefined,
    "Failed to create entity: all entity identifiers are in use",
  )

  return id as Entity.Id<D>
}

function ofGenerationUnsafe(registry: Struct, entityId: number, entityGen: number) {
  return entityGen === SharedSparse.get(registry.entityIndex, entityId)?.getUint32(8)
}

function isPrimitive(typeHash: number) {
  return typeHash === ENTITY_FREE || typeHash === ENTITY_RESERVED
}

export function isAlive(registry: Struct, id: Entity.Id) {
  return ofGenerationUnsafe(registry, Entity.lo(id), Entity.hi(id))
}

export async function has(registry: Struct, entity: Entity.Id, type: Type.Struct) {
  let entityId = Entity.lo(entity)
  let entityGen = Entity.hi(entity)
  let entityLockIndex = getEntityLockIndex(registry.entityIndex, entityId)

  await Lock.lockThreadAware(registry.entityLock, entityLockIndex)

  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  let normalizedType = Type.normalize(type)
  let typeHash = SharedSparse.get(registry.entityIndex, entityId).getFloat64(OFFSET_TYPE)
  let match = false

  if (!isPrimitive(typeHash)) {
    // Acquire a table lock since an entity could have been moved into a new,
    // yet-to-be shared table on a different thread
    await Lock.lockThreadAware(registry.tableLock)
    let table = await findOrWaitForTableUnsafe(registry, typeHash)
    // If the entity's table overlaps with the input type, we know the entity
    // has those components
    match =
      table !== null &&
      (Type.contains(table.type, normalizedType) ||
        Type.isEqual(table.type, normalizedType))
    Lock.unlock(registry.tableLock)
  }

  Lock.unlock(registry.entityLock, entityLockIndex)

  return match
}

export async function add<T extends Type.Struct>(
  registry: Struct,
  entity: Entity.Id,
  type: T,
  init: Table.Row<T>,
  signals: Signals,
) {
  let entityId = Entity.lo(entity)
  let entityGen = Entity.hi(entity)
  let entityLockIndex = getEntityLockIndex(registry.entityIndex, entityId)
  let entityState = SharedSparse.get(registry.entityIndex, entityId)

  // Acquire locks
  await Lock.lockThreadAware(registry.entityLock, entityLockIndex)
  await Lock.lockThreadAware(registry.tableLock)

  // Ensure the provided entity isn't stale
  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  // Get entity table (if any)
  let prevTypeHash = entityState.getFloat64(OFFSET_TYPE)
  let prevTable: Table.Struct | null = isPrimitive(prevTypeHash)
    ? null
    : await findOrWaitForTableUnsafe(registry, prevTypeHash)

  // Produce a table from a combination of the entity's current type and newly
  // added components
  let index = entityState.getUint32(OFFSET_OFFSET)
  let nextType = prevTable ? Type.and(prevTable.type, type) : type
  let nextTypeHash = Type.hash(nextType)
  let nextTable = await findOrMakeTableUnsafe(registry, nextType, nextTypeHash, signals)

  // Insert or relocate entity
  let data = ComponentSet.make(type, init)
  if (prevTable === null) {
    await Table.insert(registry, entity, nextTable, data, signals)
  } else {
    await Table.move(registry, entity, index, prevTable, nextTable, data, signals)
  }

  // Release table lock since we're done modifying tables
  Lock.unlock(registry.tableLock, entityLockIndex)

  // Update entity location
  entityState.setFloat64(OFFSET_TYPE, nextTypeHash)

  // Release entity lock
  Lock.unlock(registry.entityLock, entityLockIndex)
}

export async function remove(
  registry: Struct,
  id: Entity.Id,
  component: Entity.Id<Schema.Struct>,
  signals: Signals,
) {}

export async function destroy(registry: Struct, entity: Entity.Id) {
  let entityId = Entity.lo(entity)
  let entityGen = Entity.hi(entity)

  // Acquire locks
  await Lock.lockThreadAware(
    registry.entityLock,
    getEntityLockIndex(registry.entityIndex, entityId),
  )
  await Lock.lockThreadAware(registry.tableLock)

  // Ensure the provided entity isn't stale
  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  const state = SharedSparse.get(registry.entityIndex, entityId)!

  // Get entity table (if any)
  let typeHash = state.getFloat64(OFFSET_TYPE)
  let table: Table.Struct | null = isPrimitive(typeHash)
    ? null
    : await findOrWaitForTableUnsafe(registry, typeHash)

  // Remove component data
  if (table) await Table.remove(registry, table, entity)

  // Update entity state

  state.setUint32(OFFSET_GEN, entityGen + 1)
  state.setFloat64(OFFSET_TYPE, ENTITY_FREE)

  // Release locks
  Lock.unlock(registry.tableLock)
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
    schema = { type: Schema.Type.Object, shape, keys: Object.keys(shape) }
  } else {
    schema = { type: Schema.Type.Binary, shape, keys: Object.keys(shape) }
  }
  let entity = await makeEntity<S>(registry)
  registry.schemaIndex[entity] = schema
  return entity
}
