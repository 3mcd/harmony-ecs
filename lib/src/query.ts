import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Model from "./model"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

/**
 * Component data sorted to match a query selector layout.
 *
 * @example <caption>Scalar binary query data</caption>
 * ```ts
 * const data: QueryRecordData<[Health]> = [
 *   Float64Array,
 * ]
 * ```
 * @example <caption>Complex binary query data (struct-of-array)</caption>
 * ```ts
 * const data: QueryRecordData<[Position, Health]> = [
 *   [{ x: Float64Array, y: Float64Array }],
 *   Float64Array,
 * ]
 * ```
 * @example <caption>Complex native query data (array-of-struct)</caption>
 * ```ts
 * const data: QueryRecordData<[Position, Health]> = [
 *   [{ x: 0, y: 0 }],
 *   [0],
 * ]
 * ```
 */
export type QueryRecordData<$Type extends Type.Type> = {
  [K in keyof $Type]: $Type[K] extends Model.SchemaId
    ? Archetype.Column<$Type[K]>["data"]
    : never
}

/**
 * A single query result.
 *
 * @example <caption>Iterating a query record (array-of-struct)</caption>
 * ```ts
 * const [e, [p, v]] = record
 * for (let i = 0; i < e.length; i++) {
 *   const entity = e[i]
 *   const position = p[i]
 *   const velocity = v[i]
 *   // ...
 * }
 * ```
 */
export type QueryRecord<$Type extends Type.Type> = [
  entities: ReadonlyArray<Entity.Id>,
  data: QueryRecordData<$Type>,
]

/**
 * An iterable list of query records, where each result corresponds to an
 * archetype (or table) of entities that match the query's selector.
 *
 * @example <caption>Iterate a query</caption>
 * ```ts
 * const query = Query.make(world, [Position, Velocity])
 * for (let i = 0; i < query.length; i++) {
 *   const [entities, [p, v]] = record
 *   // ...
 * }
 * ```
 */
export type Query<$Type extends Type.Type = Type.Type> = QueryRecord<$Type>[]

/**
 * A function that is executed when an entity is considered by a query. Returning
 * false will exclude the entity from the query results.
 */
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

/**
 * Create an auto-updating list of entities and matching components that match
 * both a set of schema ids and provided query filters, if any. The query will
 * attempt to include newly-incorporated archetypes as the ECS grows in
 * complexity.
 *
 * @example <caption>A simple motion system (struct-of-array)</caption>
 * ```ts
 * const Kinetic = [Position, Velocity] as const
 * const kinetics = Query.make(world, Kinetic)
 * for (let i = 0; i < kinetics.length; i++) {
 *   const [e, [p, v]] = kinetics
 *   for (let j = 0; j < e.length; j++) {
 *     // apply motion
 *     p.x[j] += v.x[j]
 *     p.y[j] += v.y[j]
 *   }
 * }
 * ```
 */
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

/**
 * Create an auto-updating list of results that match both a set of schema ids
 * and provided query filters, if any. The query will **not** attempt to
 * include newly-incorporated archetypes.
 *
 * @example <caption>Ignoring new archetypes</caption>
 * ```ts
 * Entity.make(world, [Point])
 * const points = Query.make(world, [Point])
 * points.reduce((a, [e]) => a + e.length, 0) // 1
 * Entity.make(world, [Point, Velocity])
 * points.reduce((a, [e]) => a + e.length, 0) // 1 (did not detect (P, V) archetype)
 * ```
 */
export function makeStatic<$Type extends Type.Type>(
  world: World.World,
  layout: $Type,
  ...filters: QueryFilter[]
): Query<$Type> {
  const type = Type.normalize(layout)
  const identity = Graph.findOrMake(world, type)
  return makeStaticQueryInternal(type, layout, identity, filters)
}

/**
 * A query filter that will exclude entities with all of the specified
 * components.
 */
export function not(layout: Type.Type) {
  const type = Type.normalize(layout)
  return function isArchetypeNotSupersetOfType(_: Type.Type, archetype: Archetype.Table) {
    return !Type.isSupersetOf(archetype.type, type)
  }
}
