import { Archetype, makeArchetype } from "./archetype"
import { ArchetypeGraphNode, makeArchetypeGraphNode } from "./archetype_graph"
import { Entity } from "./entity"
import { makeSignal, Signal } from "./signal"

export type Remote = {
  localByRemote: Map<Entity, Entity>
}

export type Registry = {
  onArchetypeCreated: Signal<Archetype>
  remotes: Map<string, Remote>
  root: ArchetypeGraphNode
  size: number
}

export function makeRegistry(size: number): Registry {
  const graveyard = makeArchetype([], size)
  return {
    onArchetypeCreated: makeSignal<Archetype>(),
    remotes: new Map(),
    root: makeArchetypeGraphNode(graveyard),
    size,
  }
}
