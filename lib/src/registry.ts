import { Archetype, makeArchetype, Type } from "./archetype"
import { ArchetypeGraphNode, makeArchetypeGraphNode } from "./archetype_graph"
import { Entity } from "./entity"
import { makeSignal, Signal } from "./signal"

export type Remote = {
  localByRemote: Map<Entity, Entity>
}

export type Registry = {
  archetypes: Map<number, ArchetypeGraphNode>
  onArchetypeCreated: Signal<Archetype>
  remotes: Map<string, Remote>
  root: ArchetypeGraphNode
  size: number
}

export function makeRegistry(size: number): Registry {
  const root = makeArchetypeGraphNode(makeArchetype([], size))
  return {
    archetypes: new Map(),
    onArchetypeCreated: makeSignal<Archetype>(),
    remotes: new Map(),
    root,
    size,
  }
}
