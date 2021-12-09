import * as TableCheck from "./table_check"
import * as Type from "./type"
import * as Entity from "./entity"

describe("TableCheck", () => {
  describe("make", () => {})

  describe("add", () => {
    it("increments the size of the TableCheck for each added hash", () => {
      let tableCheck = TableCheck.make(10)
      let typeHashes = []
      for (let i = 0; i < 10; i++) {
        let typeHash = Type.hash([i as Entity.Id])
        typeHashes.push(typeHash)
        TableCheck.add(tableCheck, typeHash)
      }
      expect(TableCheck.size(tableCheck)).toBe(10)
    })
    it("grows the size of the array beyond the initial length", () => {
      let tableCheck = TableCheck.make(10)
      let typeHashes = []
      for (let i = 0; i < 100; i++) {
        let typeHash = Type.hash([i as Entity.Id])
        typeHashes.push(typeHash)
        TableCheck.add(tableCheck, typeHash)
      }
      expect(TableCheck.size(tableCheck)).toBe(100)
    })
    it("throws for any value less than 1", () => {
      let tableCheck = TableCheck.make(10)
      expect(() => TableCheck.add(tableCheck, 0)).toThrow()
      expect(() => TableCheck.add(tableCheck, -1)).toThrow()
      expect(() => TableCheck.add(tableCheck, -Number.EPSILON)).toThrow()
      expect(() => TableCheck.add(tableCheck, Number.MIN_SAFE_INTEGER)).toThrow()
      expect(() => TableCheck.add(tableCheck, Number.MIN_VALUE)).toThrow()
    })
  })

  describe("has", () => {
    it("returns true if the TypeCheck contains the provided hash, otherwise returns false", () => {
      let tableCheck = TableCheck.make(10)
      let typeHashes = []
      for (let i = 0; i < 100; i++) {
        let typeHash = Type.hash([i as Entity.Id])
        typeHashes.push(typeHash)
        TableCheck.add(tableCheck, typeHash)
      }
      expect(TableCheck.size(tableCheck)).toBe(100)
      for (let i = 0; i < typeHashes.length; i++) {
        expect(TableCheck.has(tableCheck, typeHashes[i])).toBe(true)
      }
      expect(TableCheck.has(tableCheck, Type.hash([101 as Entity.Id]))).toBe(false)
      expect(TableCheck.has(tableCheck, 0)).toBe(false)
      expect(TableCheck.has(tableCheck, 1)).toBe(false)
    })
  })
})
