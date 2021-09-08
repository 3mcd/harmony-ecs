import { Archetype, makeRootArchetype } from "./archetype"
import { AnySchema } from "./schema"
import { makeSignal, Signal } from "./signal"

export type World = {
  archetypeRoot: Archetype
  archetypes: Map<number, Archetype>
  entityHead: number
  entityIndex: Archetype[]
  onArchetypeCreated: Signal<Archetype>
  schemaIndex: AnySchema[]
  size: number
}

export function makeWorld(size: number): World {
  return {
    archetypeRoot: makeRootArchetype(),
    archetypes: new Map(),
    entityHead: 0,
    entityIndex: [],
    onArchetypeCreated: makeSignal<Archetype>(),
    schemaIndex: [],
    size,
  }
}
