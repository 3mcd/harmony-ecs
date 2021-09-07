import { Archetype, makeRootArchetype } from "./archetype"
import { AnySchema } from "./schema"
import { makeSignal, Signal } from "./signal"

export type World = {
  archetypes: Map<number, Archetype>
  entityHead: number
  entityIndex: Archetype[]
  schemaIndex: AnySchema[]
  onArchetypeCreated: Signal<Archetype>
  root: Archetype
  size: number
}

export function makeWorld(size: number): World {
  const root = makeRootArchetype()
  return {
    archetypes: new Map(),
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    onArchetypeCreated: makeSignal<Archetype>(),
    root,
    size,
  }
}
