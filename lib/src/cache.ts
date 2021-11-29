import * as Archetype from "./archetype"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Schema from "./schema"
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
  | SparseMap.Struct<typeof Symbols.$tombstone | unknown, Schema.Id>

export type Struct = SparseMap.Struct<EntityDelta, Entity.Id>

function ensureEntityDelta(cache: Struct, entity: Entity.Id) {
  let delta = SparseMap.get(cache, entity)
  if (delta === undefined) {
    delta = SparseMap.make()
    SparseMap.set(cache, entity, delta)
  }
  return delta
}

export function set<$Signature extends Type.Struct>(
  cache: Struct,
  entity: Entity.Id,
  type: Type.Struct,
  data: Archetype.RowData<$Signature>,
) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === Symbols.$tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    SparseMap.set(delta, id, data[i])
  }
}

export function unset(cache: Struct, entity: Entity.Id, type: Type.Struct) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === Symbols.$tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    Debug.invariant(id !== undefined)
    SparseMap.set(delta, id, Symbols.$tombstone)
  }
}

export function destroy(cache: Struct, entity: Entity.Id) {
  SparseMap.set(cache, entity, Symbols.$tombstone)
}

export function make(): Struct {
  return SparseMap.make<EntityDelta, Entity.Id>()
}

export function apply(cache: Struct, world: World.Struct) {
  SparseMap.forEach(cache, function applyEntityDelta(delta, entity) {
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
  })
}

export function clear(cache: Struct) {
  SparseMap.clear(cache)
  return cache
}
