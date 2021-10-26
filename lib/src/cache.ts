import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Model from "./model"
import * as SparseMap from "./sparse_map"
import * as Type from "./type"
import * as World from "./world"
import * as Symbols from "./symbols"

// An EntityDelta describes a change made to an entity.
export type EntityDelta =
  // Remove (destroy) operations are expressed with a tombstone symbol:
  | typeof Symbols.$tombstone
  // Component changes (add/remove) are expressed as a sparse map, where the
  // keys are schema ids, and the values are component data or tombstones, in
  // the case a component was removed.
  | SparseMap.SparseMap<typeof Symbols.$tombstone | unknown, Model.SchemaId>

export type Cache = SparseMap.SparseMap<EntityDelta, Entity.Id>

function ensureEntityDelta(cache: Cache, entity: Entity.Id) {
  let delta = SparseMap.get(cache, entity)
  if (delta === undefined) {
    delta = SparseMap.make()
    SparseMap.set(cache, entity, delta)
  }
  return delta
}

export function set<$Type extends Type.Type>(
  cache: Cache,
  entity: Entity.Id,
  type: Type.Type,
  data: Archetype.Row<$Type>,
) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === Symbols.$tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    SparseMap.set(delta, id, data[i])
  }
}

export function unset(cache: Cache, entity: Entity.Id, type: Type.Type) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === Symbols.$tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    SparseMap.set(delta, id, Symbols.$tombstone)
  }
}

export function destroy(cache: Cache, entity: Entity.Id) {
  SparseMap.set(cache, entity, Symbols.$tombstone)
}

export function make(): Cache {
  return SparseMap.make<EntityDelta, Entity.Id>()
}

export function apply(cache: Cache, world: World.World) {
  SparseMap.forEach(cache, function applyEntityDelta(delta, entity) {
    // const prev = World.getEntityTable(world, entity)
    if (delta === Symbols.$tombstone) {
      Entity.destroy(world, entity)
    } else {
      SparseMap.forEach(delta, function applyComponentDelta(data, id) {
        if (data === Symbols.$tombstone) {
          Entity.unset(world, entity, [id])
        } else {
          Entity.set(world, entity, [id], [data as any])
        }
      })
    }
    // const next = World.getEntityTable(world, entity)
  })
}
