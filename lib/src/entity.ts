import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Component from "./component"
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
export function make<$Signature extends Type.Struct>(
  world: World.Struct,
  layout: $Signature = [] as unknown as $Signature,
  init: ComponentSet.Init<$Signature> = [] as unknown as ComponentSet.Init<$Signature>,
) {
  const entity = reserve(world)
  const type = Type.normalize(layout)
  const archetype = Graph.findOrMakeArchetype(world, type)
  const components = ComponentSet.make(world, layout, init)
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
export function get<$Signature extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Signature,
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
export function set<$Signature extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Signature,
  init: ComponentSet.Init<$Signature> = [] as unknown as ComponentSet.Init<$Signature>,
) {
  const components = ComponentSet.make(world, layout, init)
  // Move the entity to an archetype that is the combination of the entity's
  // existing type and the provided layout.
  const prev = World.getEntityArchetype(world, entity)
  const type = Type.and(prev.type, layout)
  const next = Graph.findOrMakeArchetype(world, type)
  if (prev === next) {
    Archetype.write(entity, prev, components)
  } else {
    Archetype.move(entity, prev, next, components)
  }
  World.setEntityArchetype(world, entity, next)
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
export function unset<$Signature extends Type.Struct>(
  world: World.Struct,
  entity: Id,
  layout: $Signature,
) {
  const prev = World.getEntityArchetype(world, entity)
  const type = Type.xor(prev.type, layout)
  const next = Graph.findOrMakeArchetype(world, type)
  Archetype.move(entity, prev, next)
  World.setEntityArchetype(world, entity, next)
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
