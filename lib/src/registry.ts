import * as ComponentSet from "./component_set"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Format from "./format"
import * as Lock from "./lock"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Table from "./table"
import * as TableCheck from "./table_check"
import * as Type from "./type"

const performance = globalThis.performance ?? require("perf_hooks").performance

const ENTITY_FREE = 0
const ENTITY_RESERVED = 1

export type Signals = Table.Signals & {
  onTableCreate: Signal.Struct<Table.Struct>
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
  tableCheck: TableCheck.Struct

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
  let entityLock = Lock.make(
    new SharedArrayBuffer(entityInit * Uint32Array.BYTES_PER_ELEMENT),
  )
  let tableLock = Lock.make(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT))
  Lock.initialize(entityLock, 0)
  Lock.initialize(tableLock, 0)

  return {
    entityGenerationIndex: new Uint32Array(
      new SharedArrayBuffer(entityInit * Uint32Array.BYTES_PER_ELEMENT),
    ),
    entityHead: new Uint32Array(new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)),
    entityLock,
    entityInit,
    entityTypeIndex: new Float64Array(
      new SharedArrayBuffer(entityInit * Float64Array.BYTES_PER_ELEMENT),
    ),
    entityOffsetIndex: new Float64Array(
      new SharedArrayBuffer(entityInit * Float64Array.BYTES_PER_ELEMENT),
    ),
    tableCheck: TableCheck.make(1_000),
    tableIndex: [],
    tableLock,
    shapeIndex: [],
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
    if (TableCheck.has(registry.tableCheck, typeHash)) {
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
      type.map(id => registry.shapeIndex[id] ?? null),
      registry.entityInit,
    )
    TableCheck.add(registry.tableCheck, typeHash)
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
  for (let i = 0; i < registry.entityInit; i++) {
    let entityId = Atomics.add(registry.entityHead, 0, 1) + 1
    // Lock the entity state while we check if it's free
    await Lock.lockThreadAware(registry.entityLock, entityId)
    // Check if entity is available
    let entityTypeHash = registry.entityTypeIndex[entityId]
    let hit = entityTypeHash === ENTITY_FREE
    if (hit) {
      // Entity is available—reserve the id
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

  await Lock.lockThreadAware(registry.entityLock, entityId)

  Debug.assert(ofGeneration(registry, entityId, entityGen))

  let normalizedType = Type.normalize(type)
  let typeHash = registry.entityTypeIndex[entityId]
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
  Debug.assert(ofGeneration(registry, entityId, entityGen))

  // Get entity table (if any)
  let prevTypeHash = registry.entityTypeIndex[entityId]
  let prevTable: Table.Struct | null = isPrimitive(prevTypeHash)
    ? null
    : await findOrWaitForTableUnsafe(registry, prevTypeHash)

  // Produce a table from a combination of the entity's current type and newly
  // added components
  let index = registry.entityOffsetIndex[entityId]
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
  registry.entityTypeIndex[entityId] = nextTypeHash
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
    schema = { type: Schema.Type.Object, shape, keys: Object.keys(shape) }
  } else {
    schema = { type: Schema.Type.Binary, shape, keys: Object.keys(shape) }
  }
  let entity = await makeEntity<S>(registry)
  registry.shapeIndex[entity] = schema
  return entity
}
