// @ts-nocheck
import { makeEntity } from "./entity"
import {
  applyDeferredOps,
  deferDeleteEntity,
  deferMakeEntity,
  deferSet,
  deferUnset,
  makeEntityManager,
} from "./entity_manager"
import { formats, makeSchema } from "./schema"
import { makeWorld } from "./world"

function makeFixture() {
  const world = makeWorld(1)
  const manager = makeEntityManager()
  const Schema = makeSchema(world, formats.uint8)
  return { world, manager, Schema }
}

describe("entity_manager", () => {
  it("stores make operations", () => {
    const { manager, Schema } = makeFixture()
    deferMakeEntity(manager, [Schema], [99])
    expect(manager.makeData[0]).toEqual([[Schema], [99]])
  })
  it("stores set operations", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [])
    deferSet(manager, entity, Schema, 99)
    expect(manager.setEntities[0]).toBe(entity)
    expect(manager.setData[entity].get(Schema)).toEqual(99)
  })
  it("stores unset operations", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [Schema])
    deferUnset(manager, entity, Schema)
    expect(manager.unsetEntities[0]).toBe(entity)
    expect(manager.unsetData[entity].has(Schema)).toBe(true)
  })
  it("stores delete operations", () => {
    const { manager } = makeFixture()
    deferDeleteEntity(manager, 1)
    expect(manager.deleteEntities.has(1)).toBe(true)
  })
})

describe("applyDeferredOps", () => {
  it("applies make operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    deferMakeEntity(manager, [Schema], [99])
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).toHaveLength(1)
    expect(world.archetypeRoot.edgesSet[0].table[0].data[0]).toBe(99)
  })
  it("applies set operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [])
    deferSet(manager, entity, Schema, 99)
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).toContain(entity)
    expect(world.archetypeRoot.edgesSet[0].table[0].data[0]).toBe(99)
  })
  it("applies unset operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [Schema])
    deferUnset(manager, entity, Schema)
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).not.toContain(entity)
  })
  it("applies delete operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [Schema])
    deferDeleteEntity(manager, entity)
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).not.toContain(entity)
  })
})
