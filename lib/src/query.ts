import { Archetype, ArchetypeTable } from "./archetype"
import { findOrMakeArchetype } from "./archetype_graph"
import { invariant } from "./debug"
import { Entity } from "./entity"
import { invariantTypeNormalized, isSupersetOf, normalizeType, Type } from "./type"
import { World } from "./world"

type QueryRecordData<$Type extends Type> = {
  [K in keyof ArchetypeTable<$Type>]: ArchetypeTable<$Type>[K]["data"]
}

export type QueryRecord<$Type extends Type> = [
  entities: ReadonlyArray<Entity>,
  data: Readonly<QueryRecordData<$Type>>,
]
export type Query<$Type extends Type = Type> = QueryRecord<$Type>[]
export type QueryFilter = (type: Type, archetype: Archetype) => boolean

function bindArchetype<$Type extends Type>(
  records: Query<$Type>,
  layout: $Type,
  archetype: Archetype,
) {
  const columns = layout.map(id => {
    const columnIndex = archetype.layout[id]
    invariant(columnIndex !== undefined)
    const column = archetype.table[columnIndex]
    invariant(column !== undefined)
    return column.data
  })
  records.push([archetype.entities, columns as unknown as QueryRecordData<$Type>])
}

function maybeBindArchetype<$Type extends Type>(
  records: Query<$Type>,
  type: Type,
  layout: $Type,
  archetype: Archetype,
  filters: QueryFilter[],
) {
  if (filters.every(predicate => predicate(type, archetype))) {
    if (archetype.real) {
      bindArchetype(records, layout, archetype)
    } else {
      const unbind = archetype.onRealize(() => {
        bindArchetype(records, layout, archetype)
        unbind()
      })
    }
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
  maybeBindArchetype(query, type, layout, identity, filters)
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
      maybeBindArchetype(query, type, layout, next, filters)
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
    maybeBindArchetype(query, type, layout, archetype, filters),
  )
  return query
}

export function not(layout: Type) {
  const type = normalizeType(layout)
  return function notFilter(_: Type, archetype: Archetype) {
    return !isSupersetOf(archetype.type, type)
  }
}
