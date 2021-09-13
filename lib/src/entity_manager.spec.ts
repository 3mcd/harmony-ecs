import { formats, makeEntity, makeSchema, makeWorld } from "."
import {
  applyDeferredOps,
  deferSet,
  deferUnset,
  makeEntityManager,
} from "./entity_manager"

function makeFixture() {
  const world = makeWorld(1)
  const manager = makeEntityManager()
  const Schema = makeSchema(world, formats.uint8)
  return { world, manager, Schema }
}

describe("entity_manager", () => {
  it("stores set operations", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [])
    deferSet(manager, entity, Schema, 99)
    expect(manager.set[0]).toBe(entity)
    expect(manager.setData[entity].get(Schema)).toEqual(99)
  })
  it("stores unset operations", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [Schema])
    deferUnset(manager, entity, Schema)
    expect(manager.unset[0]).toBe(entity)
    expect(manager.unsetData[entity].has(Schema)).toBe(true)
  })
})

describe("applyDeferredOps", () => {
  it("applies set operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [])
    deferSet(manager, entity, Schema, 99)
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).toContain(entity)
    expect(world.archetypeRoot.edgesSet[0].table[0][0]).toBe(99)
  })

  it("applies unset operations to a world", () => {
    const { world, manager, Schema } = makeFixture()
    const entity = makeEntity(world, [Schema])
    deferUnset(manager, entity, Schema)
    applyDeferredOps(world, manager)
    expect(world.archetypeRoot.edgesSet[0].entities).not.toContain(entity)
  })
})
