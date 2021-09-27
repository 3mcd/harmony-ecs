import { findOrMakeArchetype } from "./archetype_graph"
import { Entity } from "./entity"
import { QueryFilter } from "./query"
import { subscribe } from "./signal"
import { normalizeType, Type } from "./type"
import { World } from "./world"

export type Monitor = [enter: Entity[], exit: Entity[]]

export function make(world: World, layout: Type, ...filters: QueryFilter[]): Monitor {
  const monitor: Monitor = [[], []]
  const type = normalizeType(layout)
  const identity = findOrMakeArchetype(world, type)
  const [enter, exit] = monitor
  subscribe(identity.onEnter, function addInsertedEntities(entities) {
    for (let i = 0; i < entities.length; i++) {
      enter.push(entities[i]!)
    }
  })
  subscribe(identity.onExit, function addRemovedEntities(entities) {
    for (let i = 0; i < entities.length; i++) {
      exit.push(entities[i]!)
    }
  })
  return monitor
}

export function clear(monitor: Monitor) {
  const [enter, exit] = monitor
  enter.length = 0
  exit.length = 0
}
