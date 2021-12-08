import * as Registry from "./registry"
import * as Format from "./format"
import * as Signal from "./signal"

describe("Registry", () => {
  describe("add", () => {
    it("adds components to an entity", async () => {
      let signals = { onTableCreate: Signal.make(), onTableGrow: Signal.make() }
      let registry = Registry.make(10)
      let A = await Registry.makeSchema(registry, Format.uint8)
      let B = await Registry.makeSchema(registry, Format.uint8)
      let e = await Registry.makeEntity(registry)
      expect(await Registry.has(registry, e, [A, B])).toBe(false)
      await Registry.add(registry, e, [A, B], [0, 1], signals)
      expect(await Registry.has(registry, e, [A, B])).toBe(true)
    })
  })
})
