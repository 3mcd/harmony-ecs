import * as ComponentSet from "./component_set"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Table from "./table"
import * as SharedUintMap from "./shared_uint_map"
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

export type Signals = Table.Signals & {
  onTableCreate: Signal.Struct<Table.Struct>
  onRegistryGrow: Signal.Struct<
    [
      entityGenerationIndex: SharedUintMap.Struct,
      entityOffsetIndex: SharedUintMap.Struct,
      entityTypeIndex: SharedUintMap.Struct,
      tableCheck: SharedUintMap.Struct,
    ]
  >
}

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
  entityGenerationIndex: SharedUintMap.Struct

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
   * The maximum number of entities supported by the registry.
   */
  entityMax: number

  /**
   * Maps entities to the offset of their data within their current table.
   * Entity offsets are stored in this single, shared array as opposed to
   * unique arrays per-table to save memory and simplify parallelism.
   */
  entityOffsetIndex: SharedUintMap.Struct

  /**
   * Maps entities to a hash of their current type. Used to quickly look up an
   * entity's table.
   */
  entityTypeIndex: SharedUintMap.Struct

  /**
   * Multiplier used to calculate the initial component array lengths for
   * scalar and binary components. If your game had a perfectly even
   * distribution of entities across all archetypes (highly unlikely), you
   * could calculate the number of entities in any given table with
   * `roughEntityDistribution` * `entityMax`.
   */
  roughEntityDistribution: number

  /**
   * Maps identifiers to component shapes.
   */
  schemaIndex: Schema.Struct[]

  /**
   * A set that contains type hashes for tables that definitely exist on at
   * least one thread. Used to inform other threads of the existence of a table
   * that hasn't been shared yet.
   */
  tableCheck: SharedUintMap.Struct

  /**
   * Maps type hashes to their table.
   */
  tableIndex: Table.Struct[]

  /**
   * A lock used to temporarily reserve access to the creation of new tables.
   */
  tableLock: Lock.Struct
}

export function make(entityInit = 1_000, roughEntityDistribution = 0.1): Struct {
  let entityLock = Lock.make(
    new SharedArrayBuffer(entityInit * Uint32Array.BYTES_PER_ELEMENT),
  )
  let tableLock = Lock.make(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT))
  Lock.initialize(entityLock, 0)
  Lock.initialize(tableLock, 0)

  return {
    entityGenerationIndex: SharedUintMap.make(entityInit, 0.7, Uint32Array, Uint32Array),
    entityHead: new Uint32Array(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)),
    entityLock,
    entityMax: entityInit,
    entityTypeIndex: SharedUintMap.make(entityInit, 0.7, Uint32Array, Float64Array),
    entityOffsetIndex: SharedUintMap.make(entityInit, 0.7, Uint32Array, Float64Array),
    roughEntityDistribution,
    schemaIndex: [],
    tableCheck: SharedUintMap.make(1_000),
    tableIndex: [],
    tableLock,
  }
}

/**
 * Wait for a table to (magically) appear. Throw if a table doesn't show up
 * after the provided timeout.
 */
function waitForTableUnsafe(registry: Struct, typeHash: number, timeout = 1000) {
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
 * Resolves `null` if the table does not exist.
 */
async function findOrWaitForTableUnsafe(
  registry: Struct,
  typeHash: number,
): Promise<Table.Struct | null> {
  let table = registry.tableIndex[typeHash]
  if (table === undefined) {
    if (SharedUintMap.has(registry.tableCheck, typeHash)) {
      table = await waitForTableUnsafe(registry, typeHash)
    }
  }
  return table ?? null
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

  let table = await findOrWaitForTableUnsafe(registry, typeHash)
  if (table === null) {
    table = Table.make(
      type,
      type.map(id => registry.schemaIndex[id] ?? null),
      registry.entityMax * registry.roughEntityDistribution,
    )
    SharedUintMap.set(registry.tableCheck, typeHash)
    registry.tableIndex[typeHash] = table
    Signal.dispatch(signals.onTableCreate, table)
  }

  Lock.unlock(registry.tableLock)

  return table
}

/**
 * Make an entity.
 */
export async function makeEntity<D>(registry: Struct) {
  let id: Entity.Id | undefined

  for (let i = 0; i < registry.entityMax; i++) {
    let entityId = Atomics.add(registry.entityHead, 0, 1) + 1
    // Lock the entity state while we check if it's free
    await Lock.lockThreadAware(registry.entityLock, entityId)
    // Check if entity is available
    let entityTypeHash = SharedUintMap.get(registry.entityTypeIndex, entityId)
    let hit = entityTypeHash === ENTITY_FREE
    if (hit) {
      // Entity is available—reserve the id
      SharedUintMap.set(registry.entityTypeIndex, entityId, ENTITY_RESERVED)
      id = Entity.pack(
        entityId,
        SharedUintMap.get(registry.entityGenerationIndex, entityId)!,
      ) as Entity.Id
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

function ofGenerationUnsafe(registry: Struct, entityId: number, entityGen: number) {
  return entityGen === SharedUintMap.get(registry.entityGenerationIndex, entityId)
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

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  let normalizedType = Type.normalize(type)
  let typeHash = SharedUintMap.get(registry.entityTypeIndex, entityId)!
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

  Lock.unlock(registry.entityLock)

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

  // Acquire a lock on the entity
  await Lock.lockThreadAware(registry.entityLock, entityId)

  // Ensure the entity in question isn't stale
  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  // Get entity table (if any)
  let prevTypeHash = SharedUintMap.get(registry.entityTypeIndex, entityId)!
  let prevTable: Table.Struct | null = isPrimitive(prevTypeHash)
    ? null
    : await findOrWaitForTableUnsafe(registry, prevTypeHash)

  // Produce a table from a combination of the entity's current type and newly
  // added components
  let index = SharedUintMap.get(registry.entityOffsetIndex, entityId)!
  let nextType = prevTable ? Type.and(prevTable.type, type) : type
  let nextTypeHash = Type.hash(nextType)
  let nextTable = await findOrMakeTable(registry, nextType, nextTypeHash, signals)

  // Insert or relocate entity
  let data = ComponentSet.make(type, init)
  if (prevTable === null) {
    await Table.insert(registry, entity, nextTable, data, signals)
  } else {
    await Table.move(registry, entity, index, prevTable, nextTable, data, signals)
  }

  // Update entity location
  SharedUintMap.set(registry.entityTypeIndex, entityId, nextTypeHash)
  // Release lock
  Lock.unlock(registry.entityLock)
}

export async function remove(
  registry: Struct,
  id: Entity.Id,
  component: Entity.Id<Schema.Struct>,
  signals: Signals,
) {}

export async function destroy(registry: Struct, id: Entity.Id) {
  let entityId = Entity.lo(id)
  let entityGen = Entity.hi(id)

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGenerationUnsafe(registry, entityId, entityGen))

  let currentGen = SharedUintMap.get(registry.entityGenerationIndex, entityId)!

  if (entityGen === currentGen) {
    SharedUintMap.set(registry.entityGenerationIndex, entityId, currentGen + 1)
    SharedUintMap.set(registry.entityTypeIndex, entityId, ENTITY_FREE)
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
    schema = { type: Schema.Type.Object, shape, keys: Object.keys(shape) }
  } else {
    schema = { type: Schema.Type.Binary, shape, keys: Object.keys(shape) }
  }
  let entity = await makeEntity<S>(registry)
  registry.schemaIndex[entity] = schema
  return entity
}
