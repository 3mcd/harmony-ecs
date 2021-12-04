import { add, destroy, make, makeRegistry, Registry, isAlive, has, Type } from "./f"

describe("f", () => {
  describe("makeRegistry", () => {})
  describe("add", () => {
    let r: Registry
    beforeEach(() => {
      r = makeRegistry(10)
    })
    it("assigns a component to an entity", async () => {
      let t: Type = []
      const e = await make(r)
      for (let i = 0; i < 5; i++) {
        const id = await make(r)
        await add(r, e, id)
        t.push(id)
      }
      expect(await has(r, e, t)).toBe(true)
    })
  })
  describe("destroy", () => {
    let r: Registry
    beforeEach(() => {
      r = makeRegistry(10)
    })
    it("invalidates destroyed entity ids", async () => {
      const e = await make(r)
      expect(isAlive(r, e)).toBe(true)
      await destroy(r, e)
      expect(isAlive(r, e)).toBe(false)
    })
  })
})
