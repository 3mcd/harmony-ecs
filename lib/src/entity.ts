import * as Archetype from "./archetype"
import * as Graph from "./archetype_graph"
import * as Component from "./component"
import * as Debug from "./debug"
import * as Type from "./type"
import * as World from "./world"

export type Id = number

export function deleteEntity(world: World.World, entity: Id) {
  const table = world.entityIndex[entity]
  Debug.invariant(
    table !== undefined,
    `Failed to delete entity: entity "${entity}" does not have an archetype`,
  )
  Archetype.remove(table, entity)
  World.unsetEntityTable(world, entity)
}

export function set<$Type extends Type.Type>(
  world: World.World,
  entity: Id,
  layout: $Type,
  init: Component.ComponentSetInit<$Type> = [] as unknown as Component.ComponentSetInit<$Type>,
) {
  let next: Archetype.Table
  const prev = World.tryGetEntityTable(world, entity)
  const components = Component.makeComponentSet(world, layout, init)
  // Entity either doesn't exist, or was previously destroyed.
  if (prev === undefined) {
    // Insert the entity into an archetype defined by the provided layout.
    const type = Type.normalize(layout)
    next = Graph.findOrMake(world, type)
    Archetype.insert(next, entity, components)
  } else {
    // Move the entity to an archetype that is the combination of the entity's
    // existing type and the provided layout.
    const type = Type.and(prev.type, layout)
    next = Graph.findOrMake(world, type)
    if (prev === next) {
      Archetype.write(entity, prev, components)
    } else {
      Archetype.move(entity, prev, next, components)
    }
  }
  World.setEntityTable(world, entity, next)
}

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

export function has(world: World.World, entity: Id, layout: Type.Type) {
  const table = World.getEntityTable(world, entity)
  const type = Type.normalize(layout)
  Debug.invariant(
    table !== undefined,
    `Failed to check entity's components: entity "${entity}" does not have an archetype`,
  )
  return Type.isEqual(table.type, type) || Type.isSupersetOf(table.type, type)
}

export function make<$Type extends Type.Type>(
  world: World.World,
  layout: $Type = [] as unknown as $Type,
  init: Archetype.Row<$Type> = Component.expressType(world, layout),
) {
  const entity = World.reserveEntity(world)
  set(world, entity, layout, init)
  return entity
}
