import { Archetype, ArchetypeTable, Type, typeContains } from "./archetype"
import { Entity } from "./entity"
import { World } from "./world"

export type QueryRecord<$Type extends Type> = [
  entities: ReadonlyArray<Entity>,
  data: Readonly<ArchetypeTable<$Type>>,
]
export type Query<$Type extends Type = Type> = ReadonlyArray<QueryRecord<$Type>>

export function not<$Query extends Query, $Exclude extends Type>(
  query: $Query,
  exclude: $Exclude,
) {
  return query
}

export function makeQuery<$Type extends Type>(world: World, type: $Type): Query<$Type> {
  const records: QueryRecord<$Type>[] = []
  function maybeRegisterArchetype(archetype: Archetype) {
    if (typeContains(archetype.type, type)) {
      const columns = type.map(schema => archetype.table[archetype.type.indexOf(schema)])
      records.push([
        archetype.entities,
        // TODO(3mcd): unsure how to get TypeScript to agree with this without
        // casting to unknown
        columns as unknown as Readonly<ArchetypeTable<$Type>>,
      ])
    }
  }

  world.archetypes.forEach(maybeRegisterArchetype)
  world.onArchetypeCreated(maybeRegisterArchetype)

  return records
}
