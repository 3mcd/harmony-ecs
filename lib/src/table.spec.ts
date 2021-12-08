import * as Table from "./table"
import * as Registry from "./registry"
import * as Format from "./format"
import * as Schema from "./schema"
import * as Signal from "./signal"

describe("Table", () => {
  describe("iter", () => {
    it("iterates the entities in a table", async () => {
      let signals = { onTableCreate: Signal.make(), onTableGrow: Signal.make() }
      let registry = Registry.make(10)
      let A = await Registry.makeEntity(registry)
      let table = Table.make([A] as const, [null], 10)
      let e1 = await Registry.makeEntity(registry)
      let e2 = await Registry.makeEntity(registry)
      let e3 = await Registry.makeEntity(registry)
      let e4 = await Registry.makeEntity(registry)
      await Table.insert(table, e1, [null], signals)
      await Table.insert(table, e2, [null], signals)
      await Table.insert(table, e3, [null], signals)
      await Table.insert(table, e4, [null], signals)
      let results = []
      let it = Table.iter(table)
      for (let i of await it()) results.push(table.entities[i])
      expect(results.sort()).toEqual([e1, e2, e3, e4])
    })
  })
  describe("insert", () => {
    it("accommodates rows inserted past initial size", async () => {
      let signals = { onTableCreate: Signal.make(), onTableGrow: Signal.make() }
      let registry = Registry.make(1_000)
      let A = await Registry.makeSchema(registry, Format.uint8)
      let table = Table.make(
        [A] as const,
        [{ type: Schema.Type.Scalar, shape: Format.uint8 }],
        10,
      )
      for (let i = 0; i < 100; i++) {
        await Table.insert(table, await Registry.makeEntity(registry), [0], signals)
      }
      let results = []
      let it = Table.iter(table)
      for (let i of await it()) results.push(i)
      expect(results.length).toEqual(100)
    })
  })
})
