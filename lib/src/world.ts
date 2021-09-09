import { Archetype, makeRootArchetype } from "./archetype"
import { AnySchema } from "./schema"

export type World = {
  archetypeRoot: Archetype
  archetypes: Archetype[]
  entityHead: number
  entityIndex: Archetype[]
  schemaIndex: AnySchema[]
  size: number
}

export function makeWorld(size: number): World {
  return {
    archetypeRoot: makeRootArchetype(),
    archetypes: [],
    entityHead: 0,
    entityIndex: [],
    schemaIndex: [],
    size,
  }
}
