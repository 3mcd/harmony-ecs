import * as UintSet from "./shared_uint_map"
import * as Type from "./type"
import * as Entity from "./entity"

describe("UintSet", () => {
  describe("make", () => {})

  describe("add", () => {
    it("increments the size of the UintSet for each added hash", () => {
      let set = UintSet.make(10)
      let hashes: number[] = []
      for (let i = 0; i < 10; i++) {
        let hash = Type.hash([i as Entity.Id])
        hashes.push(hash)
        UintSet.set(set, hash)
      }
      expect(UintSet.size(set)).toBe(10)
    })
    it("grows the size of the array beyond the initial length", () => {
      let set = UintSet.make(10)
      let hashes: number[] = []
      for (let i = 0; i < 100; i++) {
        let hash = Type.hash([i as Entity.Id])
        hashes.push(hash)
        UintSet.set(set, hash)
      }
      expect(UintSet.size(set)).toBe(100)
    })
    it("throws for any value less than 1", () => {
      let set = UintSet.make(10)
      expect(() => UintSet.set(set, 0)).toThrow()
      expect(() => UintSet.set(set, -1)).toThrow()
      expect(() => UintSet.set(set, -Number.EPSILON)).toThrow()
      expect(() => UintSet.set(set, Number.MIN_SAFE_INTEGER)).toThrow()
      expect(() => UintSet.set(set, Number.MIN_VALUE)).toThrow()
    })
  })

  describe("has", () => {
    it("returns true if the TypeCheck contains the provided hash, otherwise returns false", () => {
      let set = UintSet.make(10)
      let hashes: number[] = []
      for (let i = 0; i < 100; i++) {
        let hash = Type.hash([i as Entity.Id])
        hashes.push(hash)
        UintSet.set(set, hash)
      }
      expect(UintSet.size(set)).toBe(100)
      for (let i = 0; i < hashes.length; i++) {
        expect(UintSet.has(set, hashes[i])).toBe(true)
      }
      expect(UintSet.has(set, Type.hash([101 as Entity.Id]))).toBe(false)
      expect(UintSet.has(set, 0)).toBe(false)
      expect(UintSet.has(set, 1)).toBe(false)
    })
  })
})
