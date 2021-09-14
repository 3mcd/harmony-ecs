import { Archetype, ArchetypeTable } from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { Entity } from "./entity"
import { invariantTypeNormalized, isSupersetOf, normalizeType, Type } from "./type"
import { World } from "./world"

export type QueryRecord<$Type extends Type> = [
  entities: ReadonlyArray<Entity>,
  data: Readonly<ArchetypeTable<$Type>>,
]
export type Query<$Type extends Type = Type> = QueryRecord<$Type>[]
export type QueryFilter = (type: Type, archetype: Archetype) => boolean

function maybeInsertRecord<$Type extends Type>(
  records: Query<$Type>,
  type: Type,
  layout: $Type,
  archetype: Archetype,
  filters: QueryFilter[],
) {
  if (filters.every(predicate => predicate(type, archetype))) {
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
  type: Type,
  layout: $Type,
  identity: Archetype,
  filters: QueryFilter[],
): Query<$Type> {
  const query: Query<$Type> = []
  invariantTypeNormalized(type)
  // insert identity archetype
  maybeInsertRecord(query, type, layout, identity, filters)
  // since the archetype graph can contain cycles, we maintain a set of the
  // archetypes we've visited. this strategy seems naive and can likely be
  // further optimized
  const visited = new Set<Archetype>()
  const stack: (Archetype | number)[] = [0, identity]
  let i = stack.length
  // recursively add each superset to the query
  while (i > 0) {
    const node = stack[--i] as Archetype
    const index = stack[--i] as number
    // base case: no more edges
    if (index < node.edgesSet.length - 1) {
      stack[i++] = index + 1
      stack[i++] = node
    }
    // archetype edge collections are sparse arrays, so this could be undfined
    const next = node.edgesSet[index]
    // only recurse into unvisited archetypes
    if (next && !visited.has(next)) {
      visited.add(next)
      maybeInsertRecord(query, type, layout, next, filters)
      stack[i++] = 0
      stack[i++] = next
    }
  }
  return query
}

export function makeStaticQuery<$Type extends Type>(
  world: World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = normalizeType(layout)
  const identity = findOrMakeArchetype(world, type)
  return makeStaticQueryInternal(type, layout, identity, filters)
}

export function makeQuery<$Type extends Type>(
  world: World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = normalizeType(layout)
  const identity = findOrMakeArchetype(world, type)
  const query = makeStaticQueryInternal(type, layout, identity, filters)
  identity.onArchetypeInsert(archetype =>
    maybeInsertRecord(query, type, layout, archetype, filters),
  )
  return query
}

export function not(layout: Type) {
  const type = normalizeType(layout)
  return function notFilter(_: Type, archetype: Archetype) {
    return !isSupersetOf(archetype.type, type)
  }
}
