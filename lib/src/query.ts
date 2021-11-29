import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Schema from "./schema"
import * as Signal from "./signal"
import * as Type from "./type"
import * as World from "./world"

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
export type RecordData<$Signature extends Type.Struct> = {
  [K in keyof $Signature]: $Signature[K] extends Schema.Id
    ? Archetype.Column<$Signature[K]>["data"]
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
export type Record<$Signature extends Type.Struct> = [
  entities: ReadonlyArray<Entity.Id>,
  data: RecordData<$Signature>,
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
export type Struct<$Signature extends Type.Struct = Type.Struct> = Record<$Signature>[]
/**
 * A function that is executed when an entity is considered by a query. Returning
 * false will exclude the entity from the query results.
 */
export type Filter = (type: Type.Struct, archetype: Archetype.Struct) => boolean

function bindArchetype<$Signature extends Type.Struct>(
  records: Struct<$Signature>,
  layout: $Signature,
  archetype: Archetype.Struct,
) {
  const columns = layout.map(function findColumnDataById(id) {
    const columnIndex = archetype.layout[id]
    Debug.invariant(columnIndex !== undefined)
    const column = archetype.store[columnIndex]
    Debug.invariant(column !== undefined)
    return column.data
  })
  records.push([archetype.entities, columns as unknown as RecordData<$Signature>])
}

function maybeBindArchetype<$Signature extends Type.Struct>(
  records: Struct<$Signature>,
  type: Type.Struct,
  layout: $Signature,
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

function makeStaticQueryInternal<$Signature extends Type.Struct>(
  type: Type.Struct,
  layout: $Signature,
  archetype: Archetype.Struct,
  filters: Filter[],
): Struct<$Signature> {
  const query: Struct<$Signature> = []
  Type.invariantNormalized(type)
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
export function make<$Signature extends Type.Struct>(
  world: World.Struct,
  layout: $Signature,
  ...filters: Filter[]
): Struct<$Signature> {
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
export function makeStatic<$Signature extends Type.Struct>(
  world: World.Struct,
  layout: $Signature,
  ...filters: Filter[]
): Struct<$Signature> {
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
