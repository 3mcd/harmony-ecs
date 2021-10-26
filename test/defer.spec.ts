import { Entity, Schema, World } from "../lib/src"
import * as Cache from "../lib/src/cache"
import * as Monitor from "../lib/src/monitor"

describe("defer", () => {
  it("works", () => {
    const world = World.make(10)
    const cache = Cache.make()
    const A = Schema.make(world, {})
    const entities: number[] = []
    for (let i = 0; i < 10; i++) {
      entities.push(Entity.make(world, [A]))
    }
    const m = Monitor.make(world, [A])
    for (let i = 0; i < entities.length; i++) {
      Cache.destroy(cache, entities[i]!)
    }
    Cache.apply(cache, world)
  })
})
