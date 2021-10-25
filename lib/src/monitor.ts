import * as Graph from "./archetype_graph"
import * as Entity from "./entity"
import * as Query from "./query"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

export type Monitor = [enter: Entity.Entity[], exit: Entity.Entity[]]

export function make(
  world: World.World,
  layout: Type.Type,
  ...filters: Query.QueryFilter[]
): Monitor {
  const monitor: Monitor = [[], []]
  const type = Type.normalize(layout)
  const identity = Graph.findOrMake(world, type)
  const [enter, exit] = monitor
  Signal.subscribe(identity.onEnter, function addInsertedEntities(entities) {
    for (let i = 0; i < entities.length; i++) {
      enter.push(entities[i]!)
    }
  })
  Signal.subscribe(identity.onExit, function addRemovedEntities(entities) {
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
