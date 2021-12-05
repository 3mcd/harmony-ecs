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
      let e = await make(r)
      for (let i = 0; i < 5; i++) {
        let id = await make(r)
        await add(r, e, id, 0, [])
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
      let e = await make(r)
      expect(isAlive(r, e)).toBe(true)
      await destroy(r, e)
      expect(isAlive(r, e)).toBe(false)
    })
  })
})
