import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"
import * as Symbols from "./symbols"

/**
 * Component data sorted to match a query selector layout.
 *
 * @example <caption>Scalar binary query data</caption>
 * ```ts
 * const data: Query.RecordData<[Health]> = [
 *   Float64Array,
 * ]
 * ```
 * @example <caption>Complex binary query data (struct-of-array)</caption>
 * ```ts
 * const data: Query.RecordData<[Position, Health]> = [
 *   [{ x: Float64Array, y: Float64Array }],
 *   Float64Array,
 * ]
 * ```
 * @example <caption>Complex native query data (array-of-struct)</caption>
 * ```ts
 * const data: Query.RecordData<[Position, Health]> = [
 *   [{ x: 0, y: 0 }],
 *   [0],
 * ]
 * ```
 */
export type RecordData<$Type extends Type.Struct> = {
  [K in keyof $Type]: $Type[K] extends Schema.Id
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
export type Record<$Type extends Type.Struct> = [
  entities: ReadonlyArray<Entity.Id>,
  data: RecordData<$Type>,
]

/**
 * An iterable list of query records, where each result corresponds to an
 * archetype (or archetype) of entities that match the query's selector.
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
export type Struct<$Type extends Type.Struct = Type.Struct> = Record<$Type>[] & {
  [Symbols.$type]: Type.Struct
}
/**
 * A function that is executed when an entity is considered by a query. Returning
 * false will exclude the entity from the query results.
 */
export type Filter = (type: Type.Struct, archetype: Archetype.Struct) => boolean

function bindArchetype<$Type extends Type.Struct>(
  records: Struct<$Type>,
  layout: $Type,
  archetype: Archetype.Struct,
) {
  const columns = layout.map(function findColumnDataById(id) {
    const columnIndex = archetype.layout[id]
    Debug.invariant(columnIndex !== undefined)
    const column = archetype.store[columnIndex]
    Debug.invariant(column !== undefined)
    return column.data
  })
  records.push([archetype.entities, columns as unknown as RecordData<$Type>])
}

function maybeBindArchetype<$Type extends Type.Struct>(
  records: Struct<$Type>,
  type: Type.Struct,
  layout: $Type,
  archetype: Archetype.Struct,
  filters: Filter[],
) {
  if (
    filters.every(function testPredicate(predicate) {
      return predicate(type, archetype)
    })
  ) {
    if (archetype.real) {
      bindArchetype(records, layout, archetype)
    } else {
      const unsubscribe = Signal.subscribe(
        archetype.onRealize,
        function bindArchetypeAndUnsubscribe() {
          bindArchetype(records, layout, archetype)
          unsubscribe()
        },
      )
    }
  }
}

function makeStaticQueryInternal<$Type extends Type.Struct>(
  type: Type.Struct,
  layout: $Type,
  archetype: Archetype.Struct,
  filters: Filter[],
): Struct<$Type> {
  Type.invariantNormalized(type)
  const query: Struct<$Type> = Object.assign([], { [Symbols.$type]: type })
  maybeBindArchetype(query, type, layout, archetype, filters)
  Graph.traverse(archetype, function maybeBindNextArchetype(archetype) {
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
export function make<$Type extends Type.Struct>(
  world: World.Struct,
  layout: $Type,
  ...filters: Filter[]
): Struct<$Type> {
  const type = Type.normalize(layout)
  const identity = Graph.findOrMakeArchetype(world, type)
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
export function makeStatic<$Type extends Type.Struct>(
  world: World.Struct,
  layout: $Type,
  ...filters: Filter[]
): Struct<$Type> {
  const type = Type.normalize(layout)
  const identity = Graph.findOrMakeArchetype(world, type)
  return makeStaticQueryInternal(type, layout, identity, filters)
}

/**
 * A query filter that will exclude entities with all of the specified
 * components.
 */
export function not(layout: Type.Struct) {
  const type = Type.normalize(layout)
  return function isArchetypeNotSupersetOfType(
    _: Type.Struct,
    archetype: Archetype.Struct,
  ) {
    return !Type.isSupersetOf(archetype.type, type)
  }
}
