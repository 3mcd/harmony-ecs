import * as Schema from "./schema"
import * as Type from "./type"

describe("Type", () => {
  describe("add", () => {
    it("refuses an abnormal type", () => {
      const type = [2, 1, 0] as Schema.Id[]
      expect(() => Type.add(type, 0 as Schema.Id)).toThrowError("abnormal type")
    })
    it("prepends a type to a normal type", () => {
      const type = [1, 2, 3] as Schema.Id[]
      expect(Type.add(type, 0 as Schema.Id)).toEqual([0, 1, 2, 3])
    })
    it("inserts a type within a normal type", () => {
      const type = [0, 1, 3] as Schema.Id[]
      expect(Type.add(type, 2 as Schema.Id)).toEqual([0, 1, 2, 3])
    })
    it("appends a type to a normal type", () => {
      const type = [0, 1, 2] as Schema.Id[]
      expect(Type.add(type, 3 as Schema.Id)).toEqual([0, 1, 2, 3])
    })
  })

  describe("remove", () => {
    it("refuses an abnormal type", () => {
      const type = [2, 1, 0] as Schema.Id[]
      expect(() => Type.remove(type, 0 as Schema.Id)).toThrowError("abnormal type")
    })
    it("shifts a sub-type from a normal type", () => {
      const type = [0, 1, 2, 3] as Schema.Id[]
      expect(Type.remove(type, 0 as Schema.Id)).toEqual([1, 2, 3])
    })
    it("splices a sub-type from a normal type", () => {
      const type = [0, 1, 2, 3] as Schema.Id[]
      expect(Type.remove(type, 2 as Schema.Id)).toEqual([0, 1, 3])
    })
    it("pops a sub-type from a normal type", () => {
      const type = [0, 1, 2, 3] as Schema.Id[]
      expect(Type.remove(type, 3 as Schema.Id)).toEqual([0, 1, 2])
    })
  })

  describe("normalize", () => {
    it("sorts a sub-type in ascending order", () => {
      const type = [7, 3, 1, 9, 6] as Schema.Id[]
      expect(Type.normalize(type)).toEqual([1, 3, 6, 7, 9])
    })
  })

  describe("isSupersetOf", () => {
    it("asserts normal types", () => {
      const normal = [0, 1, 2] as Schema.Id[]
      const abnormal = [2, 0] as Schema.Id[]
      expect(() => Type.isSupersetOf(normal, abnormal)).toThrowError("abnormal type")
      expect(() => Type.isSupersetOf(abnormal, normal)).toThrowError("abnormal type")
    })
    it("matches type where type contains each element of sub-type", () => {
      const outer = [0, 3, 8, 12, 17] as Schema.Id[]
      const inner = [0, 12, 17] as Schema.Id[]
      expect(Type.isSupersetOf(outer, inner)).toBe(true)
    })
    it("fails to match type where type does not contain each element of sub-type", () => {
      const outer = [0, 3, 8, 12, 17] as Schema.Id[]
      const inner = [0, 11, 17] as Schema.Id[]
      expect(Type.isSupersetOf(outer, inner)).toBe(false)
    })
  })

  describe("maybeSupersetOf", () => {
    it("asserts normal types", () => {
      const normal = [0, 1, 2] as Schema.Id[]
      const abnormal = [2, 0] as Schema.Id[]
      expect(() => Type.maybeSupersetOf(normal, abnormal)).toThrowError("abnormal type")
      expect(() => Type.maybeSupersetOf(abnormal, normal)).toThrowError("abnormal type")
    })
    it("matches type where outer type may be subset of eventual superset of inner type", () => {
      expect(Type.maybeSupersetOf([0] as Schema.Id[], [1, 2, 3, 4] as Schema.Id[])).toBe(
        true,
      )
      expect(Type.maybeSupersetOf([7, 9] as Schema.Id[], [9, 10] as Schema.Id[])).toBe(
        true,
      )
      expect(
        Type.maybeSupersetOf([5, 6, 7, 8] as Schema.Id[], [6, 99] as Schema.Id[]),
      ).toBe(true)
    })
    it("fails to mach type where outer type may never be subset of superset of inner type", () => {
      expect(Type.maybeSupersetOf([0, 5] as Schema.Id[], [4, 5, 6] as Schema.Id[])).toBe(
        false,
      )
      expect(Type.maybeSupersetOf([9, 10] as Schema.Id[], [7, 9] as Schema.Id[])).toBe(
        false,
      )
      expect(Type.maybeSupersetOf([5] as Schema.Id[], [6, 12] as Schema.Id[])).toBe(true)
    })
  })

  describe("getIdsBetween", () => {
    it("asserts outer is superset of subset", () => {
      const outer = [0, 2] as Schema.Id[]
      const inner = [0, 1, 2] as Schema.Id[]
      expect(() => Type.getIdsBetween(outer, inner)).toThrowError("type is not superset")
    })
    it("builds an array of type ids between inner and outer", () => {
      expect(
        Type.getIdsBetween([0, 1, 4, 9, 12, 17] as Schema.Id[], [9, 17] as Schema.Id[]),
      ).toEqual([0, 1, 4, 12])
      expect(Type.getIdsBetween([0, 1, 2] as Schema.Id[], [1] as Schema.Id[])).toEqual([
        0,
      ])
      expect(Type.getIdsBetween([0, 1, 2, 3] as Schema.Id[], [3] as Schema.Id[])).toEqual(
        [0, 1, 2],
      )
    })
  })
})
