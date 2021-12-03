import { add, destroy, makeEntity, makeRegistry, Registry, isAlive } from "./f"

describe("f", () => {
  describe("makeRegistry", () => {})
  describe("add", () => {
    let registry: Registry
    beforeEach(() => {
      registry = makeRegistry(10)
    })
    it("assigns a component to an entity", () => {
      const entity = makeEntity(registry)
      for (let i = 0; i < 5; i++) {
        add(registry, entity, makeEntity(registry))
      }
      console.log(registry)
    })
  })
  describe("destroy", () => {
    let registry: Registry
    beforeEach(() => {
      registry = makeRegistry(10)
    })
    it("invalidates destroyed entity ids", () => {
      const entity = makeEntity(registry)
      expect(isAlive(registry, entity)).toBe(true)
      destroy(registry, entity)
      expect(isAlive(registry, entity)).toBe(false)
    })
  })
})
