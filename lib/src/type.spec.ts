import { SchemaId } from "./schema"
import {
  addToType,
  getIdsBetween,
  isSupersetOf,
  maybeSupersetOf,
  normalizeType,
  removeFromType,
} from "./type"

describe("addToType", () => {
  it("refuses an abnormal type", () => {
    const type = [2, 1, 0] as SchemaId[]
    expect(() => addToType(type, 0 as SchemaId)).toThrowError("abnormal type")
  })
  it("prepends a type to a normal type", () => {
    const type = [1, 2, 3] as SchemaId[]
    expect(addToType(type, 0 as SchemaId)).toEqual([0, 1, 2, 3])
  })
  it("inserts a type within a normal type", () => {
    const type = [0, 1, 3] as SchemaId[]
    expect(addToType(type, 2 as SchemaId)).toEqual([0, 1, 2, 3])
  })
  it("appends a type to a normal type", () => {
    const type = [0, 1, 2] as SchemaId[]
    expect(addToType(type, 3 as SchemaId)).toEqual([0, 1, 2, 3])
  })
})

describe("removeFromType", () => {
  it("refuses an abnormal type", () => {
    const type = [2, 1, 0] as SchemaId[]
    expect(() => removeFromType(type, 0 as SchemaId)).toThrowError("abnormal type")
  })
  it("shifts a type from a normal type", () => {
    const type = [0, 1, 2, 3] as SchemaId[]
    expect(removeFromType(type, 0 as SchemaId)).toEqual([1, 2, 3])
  })
  it("splices a type from a normal type", () => {
    const type = [0, 1, 2, 3] as SchemaId[]
    expect(removeFromType(type, 2 as SchemaId)).toEqual([0, 1, 3])
  })
  it("pops a type from a normal type", () => {
    const type = [0, 1, 2, 3] as SchemaId[]
    expect(removeFromType(type, 3 as SchemaId)).toEqual([0, 1, 2])
  })
})

describe("normalizeType", () => {
  it("sorts a type in ascending order", () => {
    const type = [7, 3, 1, 9, 6] as SchemaId[]
    expect(normalizeType(type)).toEqual([1, 3, 6, 7, 9])
  })
})

describe("isSupersetOf", () => {
  it("asserts normal types", () => {
    const normal = [0, 1, 2] as SchemaId[]
    const abnormal = [2, 0] as SchemaId[]
    expect(() => isSupersetOf(normal, abnormal)).toThrowError("abnormal type")
    expect(() => isSupersetOf(abnormal, normal)).toThrowError("abnormal type")
  })
  it("matches type where outer type contains each element of inner type", () => {
    const outer = [0, 3, 8, 12, 17] as SchemaId[]
    const inner = [0, 12, 17] as SchemaId[]
    expect(isSupersetOf(outer, inner)).toBe(true)
  })
  it("fails to match type where outer type does not contain each element of inner type", () => {
    const outer = [0, 3, 8, 12, 17] as SchemaId[]
    const inner = [0, 11, 17] as SchemaId[]
    expect(isSupersetOf(outer, inner)).toBe(false)
  })
})

describe("maybeSupersetOf", () => {
  it("asserts normal types", () => {
    const normal = [0, 1, 2] as SchemaId[]
    const abnormal = [2, 0] as SchemaId[]
    expect(() => maybeSupersetOf(normal, abnormal)).toThrowError("abnormal type")
    expect(() => maybeSupersetOf(abnormal, normal)).toThrowError("abnormal type")
  })
  it("matches type where outer type may be subset of eventual superset of inner type", () => {
    expect(maybeSupersetOf([0] as SchemaId[], [1, 2, 3, 4] as SchemaId[])).toBe(true)
    expect(maybeSupersetOf([7, 9] as SchemaId[], [9, 10] as SchemaId[])).toBe(true)
    expect(maybeSupersetOf([5, 6, 7, 8] as SchemaId[], [6, 99] as SchemaId[])).toBe(true)
  })
  it("fails to mach type where outer type may never be subset of superset of inner type", () => {
    expect(maybeSupersetOf([0, 5] as SchemaId[], [4, 5, 6] as SchemaId[])).toBe(false)
    expect(maybeSupersetOf([9, 10] as SchemaId[], [7, 9] as SchemaId[])).toBe(false)
    expect(maybeSupersetOf([5] as SchemaId[], [6, 12] as SchemaId[])).toBe(true)
  })
})

describe("getIdsBetween", () => {
  it("asserts outer is superset of subset", () => {
    const outer = [0, 2] as SchemaId[]
    const inner = [0, 1, 2] as SchemaId[]
    expect(() => getIdsBetween(outer, inner)).toThrowError("type is not superset")
  })
  it("builds an array of type ids between inner and outer", () => {
    expect(
      getIdsBetween([0, 1, 4, 9, 12, 17] as SchemaId[], [9, 17] as SchemaId[]),
    ).toEqual([0, 1, 4, 12])
    expect(getIdsBetween([0, 1, 2] as SchemaId[], [1] as SchemaId[])).toEqual([0])
    expect(getIdsBetween([0, 1, 2, 3] as SchemaId[], [3] as SchemaId[])).toEqual([
      0, 1, 2,
    ])
  })
})
