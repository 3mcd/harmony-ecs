import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as ComponentSet from "./component_set"
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
export function reserve(world: World.Struct, entity = world.entityHead) {
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
export function make<$Type extends Type.Struct>(
  world: World.Struct,
  layout = [] as unknown as $Type,
  init = [] as unknown as ComponentSet.Init<$Type>,
) {
  const entity = reserve(world)
  const components = ComponentSet.make(world, layout, init)
  const archetype = Graph.findOrMakeArchetype(world, Type.normalize(layout))
  Archetype.insert(archetype, entity, components)
  World.setEntityArchetype(world, entity, archetype)
  return entity
}

/**
 * Get the value of one or more components for an entity. Throws an error if
 * the entity is not real, or if it does not have a component of each of
 * the provided schema ids.
 *
 * @example <caption>Get the value of a single component</caption>
 * ```ts
 * const [position] = Entity.get(world, entity, [Position])
 * ```
 * @example <caption>Get the value of multiple components</caption>
 * ```ts
 * const [health, inventory] = Entity.get(world, entity, [Health, Inventory])
 * ```
 * @example <caption>Re-use an array to avoid allocating intermediate array</caption>
 * ```ts
 * const results = []
 * const [health, stats] = Entity.get(world, entity, Player, results)
 * ```
 */
export function get<$Type extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Type,
  out: unknown[] = [],
) {
  const archetype = World.getEntityArchetype(world, entity)
  Debug.invariant(has(world, entity, layout))
  return Archetype.read(entity, archetype, layout, out)
}

/**
 * Update the value of one or more components for an entity. If the entity does
 * not yet have components of the provided schema ids, add them. Throws an
 * error if the entity is not real.
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
export function set<$Type extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Type,
  init = [] as unknown as ComponentSet.Init<$Type>,
) {
  const components = ComponentSet.make(world, layout, init)
  const prevArchetype = World.getEntityArchetype(world, entity)
  const nextArchetype = Graph.findOrMakeArchetype(
    world,
    Type.and(prevArchetype.type, layout),
  )
  if (prevArchetype === nextArchetype) {
    Archetype.write(entity, prevArchetype, components)
  } else {
    Archetype.move(entity, prevArchetype, nextArchetype, components)
  }
  World.setEntityArchetype(world, entity, nextArchetype)
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
export function unset<$Type extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Type,
) {
  const prevArchetype = World.getEntityArchetype(world, entity)
  const nextArchetype = Graph.findOrMakeArchetype(
    world,
    Type.xor(prevArchetype.type, layout),
  )
  Archetype.move(entity, prevArchetype, nextArchetype)
  World.setEntityArchetype(world, entity, nextArchetype)
}

/**
 * Check if an entity has one or more components. Returns true if the entity
 * has a component corresponding to all of the provided schema ids, otherwise
 * returns false. Throws an error if the entity is not real.
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
export function has(world: World.Struct, entity: Id, layout: Type.Struct) {
  const archetype = World.getEntityArchetype(world, entity)
  const type = Type.normalize(layout)
  return Type.isEqual(archetype.type, type) || Type.isSupersetOf(archetype.type, type)
}

/**
 * Check if an entity has one or more components. Unlike `has`, `tryHas` will
 * not throw if the entity is not real.
 */
export function tryHas(world: World.Struct, entity: Id, layout: Type.Struct) {
  try {
    return has(world, entity, layout)
  } catch (error) {
    const final = Debug.unwrap(error)
    if (final instanceof World.EntityNotRealError) {
      return false
    }
    throw final
  }
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
export function destroy(world: World.Struct, entity: Id) {
  const archetype = World.getEntityArchetype(world, entity)
  Archetype.remove(archetype, entity)
  World.unsetEntityArchetype(world, entity)
}
