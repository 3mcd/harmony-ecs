import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Model from "./model"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

type QueryRecordData<$Type extends Type.Type> = {
  [K in keyof $Type]: $Type[K] extends Model.SchemaId
    ? Archetype.Column<$Type[K]>["data"]
    : never
}

export type QueryRecord<$Type extends Type.Type> = [
  entities: ReadonlyArray<Entity.Id>,
  data: {
    [K in keyof $Type]: $Type[K] extends Model.SchemaId
      ? Archetype.Column<$Type[K]>["data"]
      : never
  },
]
export type Query<$Type extends Type.Type = Type.Type> = QueryRecord<$Type>[]
export type QueryFilter = (type: Type.Type, table: Archetype.Table) => boolean

function bindArchetype<$Type extends Type.Type>(
  records: Query<$Type>,
  layout: $Type,
  table: Archetype.Table,
) {
  const columns = layout.map(function findColumnDataById(id) {
    const columnIndex = table.layout[id]
    Debug.invariant(columnIndex !== undefined)
    const column = table.store[columnIndex]
    Debug.invariant(column !== undefined)
    return column.data
  })
  records.push([table.entities, columns as unknown as QueryRecordData<$Type>])
}

function maybeBindArchetype<$Type extends Type.Type>(
  records: Query<$Type>,
  type: Type.Type,
  layout: $Type,
  table: Archetype.Table,
  filters: QueryFilter[],
) {
  if (
    filters.every(function testPredicate(predicate) {
      return predicate(type, table)
    })
  ) {
    if (table.real) {
      bindArchetype(records, layout, table)
    } else {
      const unsubscribe = Signal.subscribe(
        table.onRealize,
        function bindArchetypeAndUnsubscribe() {
          bindArchetype(records, layout, table)
          unsubscribe()
        },
      )
    }
  }
}

function makeStaticQueryInternal<$Type extends Type.Type>(
  type: Type.Type,
  layout: $Type,
  table: Archetype.Table,
  filters: QueryFilter[],
): Query<$Type> {
  const query: Query<$Type> = []
  Type.invariantNormalized(type)
  maybeBindArchetype(query, type, layout, table, filters)
  Graph.traverseRight(table, function maybeBindNextArchetype(archetype) {
    maybeBindArchetype(query, type, layout, archetype, filters)
  })
  return query
}

export function makeStatic<$Type extends Type.Type>(
  world: World.World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = Type.normalize(layout)
  const identity = Graph.findOrMake(world, type)
  return makeStaticQueryInternal(type, layout, identity, filters)
}

export function make<$Type extends Type.Type>(
  world: World.World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = Type.normalize(layout)
  const identity = Graph.findOrMake(world, type)
  const query = makeStaticQueryInternal(type, layout, identity, filters)
  Signal.subscribe(
    identity.onTableInsert,
    function maybeBindInsertedArchetype(archetype) {
      maybeBindArchetype(query, type, layout, archetype, filters)
    },
  )
  return query
}

export function not(layout: Type.Type) {
  const type = Type.normalize(layout)
  return function isArchetypeNotSupersetOfType(_: Type.Type, archetype: Archetype.Table) {
    return !Type.isSupersetOf(archetype.type, type)
  }
}
