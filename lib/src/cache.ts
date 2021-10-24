import { ArchetypeRow } from "./archetype"
import { invariant } from "./debug"
import { Entity } from "./entity"
import { SchemaId } from "./model"
import * as SparseMap from "./sparse_map"
import { Type } from "./type"
import { World } from "./world"

// A tombstone describes a remove operation of either an entity or a
// component.
const $tombstone = Symbol("h_tomb")

// An EntityDelta describes a change made to an entity.
type EntityDelta =
  // Remove (destroy) operations are expressed with a tombstone symbol:
  | typeof $tombstone
  // Component changes (add/remove) are expressed as a sparse map, where the
  // keys are schema ids, and the values are component data or tombstones, in
  // the case a component was removed.
  | SparseMap.SparseMap<typeof $tombstone | unknown, SchemaId>

type Cache = SparseMap.SparseMap<EntityDelta, Entity>

function ensureEntityDelta(cache: Cache, entity: Entity) {
  let delta = SparseMap.get(cache, entity)
  if (delta === undefined) {
    delta = SparseMap.make()
    SparseMap.set(cache, entity, delta)
  }
  return delta
}

export function set<$Type extends Type>(
  cache: Cache,
  entity: Entity,
  type: Type,
  data: ArchetypeRow<$Type>,
) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === $tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    SparseMap.set(delta, id, data[i])
  }
}

export function unset(cache: Cache, entity: Entity, type: Type) {
  const delta = ensureEntityDelta(cache, entity)
  if (delta === $tombstone) return
  for (let i = 0; i < type.length; i++) {
    const id = type[i]
    invariant(id !== undefined)
    SparseMap.set(delta, id, $tombstone)
  }
}

export function deleteEntity(cache: Cache, entity: Entity) {
  SparseMap.set(cache, entity, $tombstone)
}

export function make(): Cache {
  return SparseMap.make<EntityDelta, Entity>()
}

export function apply(cache: Cache, world: World) {}
