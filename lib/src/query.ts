import {
  Archetype,
  ArchetypeTable,
  invariantTypeNormalized,
  normalizeType,
  Type,
  isSupersetOf,
} from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { Entity } from "./entity"
import { World } from "./world"

export type QueryRecord<$Type extends Type> = [
  entities: ReadonlyArray<Entity>,
  data: Readonly<ArchetypeTable<$Type>>,
]
export type Query<$Type extends Type = Type> = ReadonlyArray<QueryRecord<$Type>>
export type QueryFilter = (type: Type, archetype: Archetype) => boolean

function maybeInsertRecord<$Type extends Type>(
  records: QueryRecord<$Type>[],
  type: Type,
  layout: $Type,
  archetype: Archetype,
  filters: QueryFilter[],
) {
  if (
    isSupersetOf(archetype.type, type) &&
    filters.every(predicate => predicate(type, archetype))
  ) {
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
  filters: QueryFilter[],
): Query<$Type> {
  const query: Query<$Type> = []
  invariantTypeNormalized(type)
  // ensure archetype
  findOrMakeArchetype(world, type)
  world.archetypes.forEach(archetype =>
    maybeInsertRecord(query as QueryRecord<$Type>[], type, layout, archetype, filters),
  )
  return query
}

export function makeStaticQuery<$Type extends Type>(
  world: World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  return makeStaticQueryInternal(world, normalizeType(layout), layout, filters)
}

export function makeQuery<$Type extends Type>(
  world: World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = normalizeType(layout)
  const query = makeStaticQueryInternal(world, type, layout, filters)
  world.onArchetypeCreated(archetype =>
    maybeInsertRecord(query as QueryRecord<$Type>[], type, layout, archetype, filters),
  )
  return query
}

export function not(layout: Type) {
  const type = normalizeType(layout)
  return function notFilter(_: Type, archetype: Archetype) {
    return !isSupersetOf(archetype.type, type)
  }
}
