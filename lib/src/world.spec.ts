import { makeWorld } from "./world"

describe("makeWorld", () => {
  it("creates a world with a configurable entity size", () => {
    const size = 8
    const world = makeWorld(size)
    expect(world.size).toBe(size)
  })
  it("begins entity counter at 0", () => {
    const world = makeWorld(1)
    expect(world.entityHead).toBe(0)
  })
})
