import {
  Archetype,
  ArchetypeTable,
  invariantTypeNormalized,
  normalizeType,
  Type,
  typeContains,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
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

function maybeInsertRecord<$Type extends Type>(
  records: QueryRecord<$Type>[],
  type: Type,
  layout: $Type,
  archetype: Archetype,
) {
  if (typeContains(archetype.type, type)) {
    const columns = layout.map(id => archetype.table[archetype.layout[id]])
    records.push([
      archetype.entities,
      // TODO(3mcd): unsure how to get TypeScript to agree with this without
      // casting to unknown
      columns as unknown as Readonly<ArchetypeTable<$Type>>,
    ])
  }
}

function makeStaticQueryInternal<$Type extends Type>(
  world: World,
  type: Type,
  layout: $Type,
): Query<$Type> {
  const query: Query<$Type> = []
  invariantTypeNormalized(type)
  // ensure archetype
  findOrMakeArchetype(world, type)
  world.archetypes.forEach(archetype =>
    maybeInsertRecord(query as QueryRecord<$Type>[], type, layout, archetype),
  )
  return query
}

export function makeStaticQuery<$Type extends Type>(
  world: World,
  layout: $Type,
): Query<$Type> {
  return makeStaticQueryInternal(world, normalizeType(layout), layout)
}

export function makeQuery<$Type extends Type>(world: World, layout: $Type): Query<$Type> {
  const type = normalizeType(layout)
  const query = makeStaticQueryInternal(world, type, layout)
  world.onArchetypeCreated(archetype =>
    maybeInsertRecord(query as QueryRecord<$Type>[], type, layout, archetype),
  )
  return query
}
