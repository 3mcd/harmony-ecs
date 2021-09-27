import { Archetype, ArchetypeColumn } from "./archetype"
import { findOrMakeArchetype, traverseRight } from "./archetype_graph"
import { invariant } from "./debug"
import { Entity } from "./entity"
import { SchemaId } from "./model"
import { subscribe } from "./signal"
import { invariantTypeNormalized, isSupersetOf, normalizeType, Type } from "./type"
import { World } from "./world"

type QueryRecordData<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId
    ? ArchetypeColumn<$Type[K]>["data"]
    : never
}

export type QueryRecord<$Type extends Type> = [
  entities: ReadonlyArray<Entity>,
  data: {
    [K in keyof $Type]: $Type[K] extends SchemaId
      ? ArchetypeColumn<$Type[K]>["data"]
      : never
  },
]
export type Query<$Type extends Type = Type> = QueryRecord<$Type>[]
export type QueryFilter = (type: Type, archetype: Archetype) => boolean

function bindArchetype<$Type extends Type>(
  records: Query<$Type>,
  layout: $Type,
  archetype: Archetype,
) {
  const columns = layout.map(function findColumnDataById(id) {
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
  if (
    filters.every(function testPredicate(predicate) {
      return predicate(type, archetype)
    })
  ) {
    if (archetype.real) {
      bindArchetype(records, layout, archetype)
    } else {
      const unsubscribe = subscribe(
        archetype.onRealize,
        function bindArchetypeAndUnsubscribe() {
          bindArchetype(records, layout, archetype)
          unsubscribe()
        },
      )
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
  traverseRight(identity, function maybeBindNextArchetype(archetype) {
    maybeBindArchetype(query, type, layout, archetype, filters)
  })
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
  subscribe(identity.onArchetypeInsert, function maybeBindInsertedArchetype(archetype) {
    maybeBindArchetype(query, type, layout, archetype, filters)
  })
  return query
}

export function not(layout: Type) {
  const type = normalizeType(layout)
  return function isArchetypeNotSupersetOfType(_: Type, archetype: Archetype) {
    return !isSupersetOf(archetype.type, type)
  }
}
