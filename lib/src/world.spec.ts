import * as World from "./world"

describe("World", () => {
  describe("make", () => {
    it("creates a world with a configurable entity size", () => {
      const size = 8
      const world = World.make(size)
      expect(world.size).toBe(size)
    })
    it("begins entity counter at 0", () => {
      const world = World.make(1)
      expect(world.entityHead).toBe(0)
    })
  })
})
