import { makeWorld } from "./world"

describe("makeWorld", () => {
  it("configures an entity count", () => {
    const count = 8
    const world = makeWorld(count)
    expect(world.size).toBe(count)
  })
  it("begins entity counter at 0", () => {
    const world = makeWorld(1)
    expect(world.entityHead).toBe(0)
  })
})
