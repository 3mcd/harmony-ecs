import * as Table from "./table"

describe("Table", () => {
  describe("iter", () => {
    it("iterates the entities in a table", async () => {
      let table = Table.make([], 10)
      Table.insert(table, [0])
      Table.insert(table, [1])
      Table.insert(table, [2])
      Table.insert(table, [3])
      for await (let e of Table.iter(table)) {
        console.log(e)
      }
    })
  })
})
