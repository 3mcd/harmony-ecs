import * as World from "./world"
import * as Cache from "./cache"
import * as Model from "./model"
import * as Query from "./query"
import * as Entity from "./entity"

describe("Cache", () => {
  it("applies set operations", () => {
    const world = World.make(10)
    const cache = Cache.make()
    const A = Model.make(world, {})
    const a = Query.make(world, [A])
    Cache.set(cache, World.reserveEntity(world), [A], [{}])
    Cache.set(cache, World.reserveEntity(world), [A], [{}])
    for (let i = 0; i < a.length; i++) {
      const [e] = a[i]!
      expect(e!.length).toBe(0)
    }
    Cache.apply(cache, world)
    for (let i = 0; i < a.length; i++) {
      const [e] = a[i]!
      expect(e!.length).toBe(2)
    }
  })
  it("applies unset operations", () => {
    const world = World.make(10)
    const cache = Cache.make()
    const A = Model.make(world, {})
    const a = Query.make(world, [A])
    const e1 = Entity.make(world, [A])
    const e2 = Entity.make(world, [A])
    for (let i = 0; i < a.length; i++) {
      const [e] = a[i]!
      expect(e!.length).toBe(2)
    }
    Cache.unset(cache, e1, [A])
    Cache.unset(cache, e2, [A])
    Cache.apply(cache, world)
    for (let i = 0; i < a.length; i++) {
      const [e] = a[i]!
      expect(e!.length).toBe(0)
    }
  })
})
