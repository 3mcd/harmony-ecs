import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Component from "./component"
import * as Debug from "./debug"
import * as Type from "./type"
import * as World from "./world"

/**
 * An unsigned integer between 0 and `Number.MAX_SAFE_INTEGER` that uniquely
 * identifies an entity or schema within the ECS.
 */
export type Id = number

/**
 * Reserve an entity id without inserting it into the world.
 *
 * @example <caption>Add a component to a reserved entity</caption>
 * ```ts
 * const entity = Entity.reserve(world)
 * Entity.has(world, entity, [Position]) // Error: Failed ... entity is not real
 * Entity.set(world, entity, [Position])
 * Entity.has(world, entity, [Position]) // true
 * ```
 */
export function reserve(world: World.World, entity = world.entityHead) {
  while (
    !(world.entityIndex[entity] === undefined && world.schemaIndex[entity] === undefined)
  ) {
    entity = world.entityHead++
  }
  return entity
}

/**
 * Create an entity using an array of schema ids as a template. Optionally
 * accepts an array of data used to initialize components. Undefined values
 * within the initializer array are filled with defaults (e.g. `0` for numeric
 * Format).
 *
 * @example <caption>Make an entity with no components</caption>
 * ```ts
 * Entity.make(world, [])
 * ```
 * @example <caption>Make an entity with one or more components</caption>
 * ```ts
 * Entity.make(world, [Health, Stamina])
 * ```
 * @example <caption>Initialize component values</caption>
 * ```ts
 * Entity.make(world, [Health, Stamina], [120, 100])
 * ```
 * @example <caption>Initialize a single component value</caption>
 * ```ts
 * Entity.make(world, [Position, Velocity], [, { x: -10, y: 42 }])
 * ```
 */
export function make<$Type extends Type.Type>(
  world: World.World,
  layout: $Type = [] as unknown as $Type,
  init: Component.ComponentSetInit<$Type> = [] as unknown as Component.ComponentSetInit<$Type>,
) {
  const entity = reserve(world)
  const type = Type.normalize(layout)
  const archetype = Graph.findOrMake(world, type)
  const components = Component.makeComponentSet(world, layout, init)
  Archetype.insert(archetype, entity, components)
  World.setEntityTable(world, entity, archetype)
  return entity
}

/**
 * Update the value of one or more components for an entity. If the entity does
 * not yet have components of the provided schema ids, add them. Throws an
 * error if the entity does not exist.
 *
 * This function has the same interface as `Entity.make`, that is, it
 * optionally accepts a sparse array of initial component values.
 *
 * @example <caption>Add or update a single component</caption>
 * ```ts
 * Entity.set(world, entity, [Position])
 * ```
 * @example <caption>Initialize component values</caption>
 * ```ts
 * Entity.set(world, entity, [Health, Stamina], [100, 120])
 * ```
 * @example <caption>Update an existing component and add a new component</caption>
 * ```ts
 * const entity = Entity.make(world, [Health], [100])
 * Entity.set(world, entity, [Health, Stamina], [99])
 * ```
 */
export function set<$Type extends Type.Type>(
  world: World.World,
  entity: Id,
  layout: $Type,
  init: Component.ComponentSetInit<$Type> = [] as unknown as Component.ComponentSetInit<$Type>,
) {
  const prev = World.getEntityTable(world, entity)
  const components = Component.makeComponentSet(world, layout, init)
  // Move the entity to an archetype that is the combination of the entity's
  // existing type and the provided layout.
  const type = Type.and(prev.type, layout)
  const next = Graph.findOrMake(world, type)
  if (prev === next) {
    Archetype.write(entity, prev, components)
  } else {
    Archetype.move(entity, prev, next, components)
  }
  World.setEntityTable(world, entity, next)
}

/**
 * Remove one or more components from an entity. Throws an error if the entity
 * does not exist.
 *
 * @example <caption>Remove a single component from an entity</caption>
 * ```ts
 * Entity.unset(world, entity, [Health])
 * ```
 * @example <caption>Remove multiple components from an entity</caption>
 * ```ts
 * Entity.unset(world, entity, [Health, Faction])
 * ```
 */
export function unset<$Type extends Type.Type>(
  world: World.World,
  entity: Id,
  layout: $Type,
) {
  const prev = World.getEntityTable(world, entity)
  const type = Type.xor(prev.type, layout)
  const next = Graph.findOrMake(world, type)
  Archetype.move(entity, prev, next)
  World.setEntityTable(world, entity, next)
}

/**
 * Check if an entity has one or more components. Returns true if the entity
 * has a component corresponding to all of the provided schema ids, otherwise
 * returns false. Throws an error if the entity does not exist.
 *
 * @example <caption>Check if an entity has a single component</caption>
 * ```ts
 * Entity.has(world, entity, [Health])
 * ```
 * @example <caption>Check if an entity has multiple components</caption>
 * ```ts
 * Entity.has(world, entity, [Position, Velocity])
 * ```
 */
export function has(world: World.World, entity: Id, layout: Type.Type) {
  const table = World.getEntityTable(world, entity)
  const type = Type.normalize(layout)
  Debug.invariant(
    table !== undefined,
    `Failed to check entity's components: entity "${entity}" is not real`,
  )
  return Type.isEqual(table.type, type) || Type.isSupersetOf(table.type, type)
}

/**
 * Remove all components from an entity. Throws an error if the entity does
 * not exist.
 *
 * @example <caption>Destroy an entity</caption>
 * ```ts
 * Entity.destroy(world, entity)
 * ```
 */
export function destroy(world: World.World, entity: Id) {
  const table = world.entityIndex[entity]
  Debug.invariant(
    table !== undefined,
    `Failed to delete entity: entity "${entity}" is not real`,
  )
  Archetype.remove(table, entity)
  World.unsetEntityTable(world, entity)
}
