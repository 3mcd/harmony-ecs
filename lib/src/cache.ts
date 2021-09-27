import { Archetype, ArchetypeData } from "./archetype"
import { traverseRight } from "./archetype_graph"
import { invariant } from "./debug"
import * as Entity from "./entity"
import { SchemaId } from "./model"
import { dispatch } from "./signal"
import * as SparseMap from "./sparse_map"
import { Type } from "./type"
import * as World from "./world"

const $tombstone = Symbol("h_tomb")

type EntityDelta =
  | typeof $tombstone
  | SparseMap.SparseMap<typeof $tombstone | unknown, SchemaId>

type Cache = {
  ops: SparseMap.SparseMap<EntityDelta, Entity.Entity>
}

export function set<$Type extends Type>(
  cache: Cache,
  entity: Entity.Entity,
  type: Type,
  data?: ArchetypeData<$Type>,
) {
  let delta = SparseMap.get(cache.ops, entity)
  if (delta === $tombstone) return
  if (delta === undefined) {
    delta = SparseMap.make()
    SparseMap.set(cache.ops, entity, delta)
  }
  if (data === undefined) {
    for (let i = 0; i < type.length; i++) {
      const schemaId = type[i]
      invariant(schemaId !== undefined)
      SparseMap.set(delta, schemaId, 1)
    }
  } else {
    for (let i = 0; i < type.length; i++) {
      const schemaId = type[i]
      invariant(schemaId !== undefined)
      SparseMap.set(delta, schemaId, data[i])
    }
  }
}

export function unset(cache: Cache, entity: Entity.Entity, type: Type) {
  let delta = SparseMap.get(cache.ops, entity)
  if (delta === $tombstone) return
  if (delta === undefined) {
    delta = SparseMap.make()
    SparseMap.set(cache.ops, entity, delta)
  }
  for (let i = 0; i < type.length; i++) {
    const schemaId = type[i]
    invariant(schemaId !== undefined)
    SparseMap.set(delta, schemaId, $tombstone)
  }
}

export function deleteEntity(cache: Cache, entity: Entity.Entity) {
  SparseMap.set(cache.ops, entity, $tombstone)
}

export function make(): Cache {
  const ops = SparseMap.make<EntityDelta, Entity.Entity>()
  return { ops }
}

export function apply(cache: Cache, world: World.World) {
  const exits = new Map<Archetype, Entity.Entity[]>()
  SparseMap.forEach(cache.ops, function handleCachedOp(o, e) {
    const source = World.getEntityLocation(world, e)
    let exit = exits.get(source)
    if (exit === undefined) {
      exits.set(source, (exit = []))
    }
    if (o === $tombstone) {
      exit.push(e)
      Entity.deleteEntity(world, e)
    }
  })
  console.log(cache.ops)
  // exits.forEach(function handleArchetypeExits(entities, archetype) {
  //   dispatch(archetype.onExit, entities)
  //   traverseRight(archetype, function dispatchOnExitSignal(right: Archetype) {
  //     dispatch(right.onExit, entities)
  //   })
  // })
}

// 1,2 -> 1,2,3 -> 1,2,3,4
// 1,2,3 rm 1: 1,2,3 -> 2,3
// get diff between 1,2,3 and 2,3
// from 1,2,3 to 2,3
