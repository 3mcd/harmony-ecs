import * as SparseMap from "./sparse_map"

describe("SparseMap", () => {
  describe("make", () => {
    it("creates an empty SparseMap when no values are provided", () => {
      const sparseMap = SparseMap.make()
      expect(sparseMap.size).toBe(0)
    })
    it("creates a SparseMap using a sparse array, initializing an entry for each index-value pair", () => {
      const sparseMap = SparseMap.make([, , , "a"])
      expect(SparseMap.get(sparseMap, 3)).toBe("a")
      expect(sparseMap.size).toBe(1)
    })
  })

  describe("get", () => {
    it("returns the value of a entry at the provided key", () => {
      const sparseMap = SparseMap.make(["a", "b"])
      expect(SparseMap.get(sparseMap, 0)).toBe("a")
      expect(SparseMap.get(sparseMap, 1)).toBe("b")
    })
    it("returns undefined for non-existing keys", () => {
      const sparseMap = SparseMap.make([, "a", "b"])
      expect(SparseMap.get(sparseMap, 0)).toBe(undefined)
    })
  })

  describe("set", () => {
    it("creates new entries at non-existing keys", () => {
      const sparseMap = SparseMap.make()
      SparseMap.set(sparseMap, 99, "a")
      SparseMap.set(sparseMap, 42, "b")
      expect(SparseMap.get(sparseMap, 99)).toBe("a")
      expect(SparseMap.get(sparseMap, 42)).toBe("b")
      expect(sparseMap.size).toBe(2)
    })
    it("updates existing entries", () => {
      const sparseMap = SparseMap.make()
      SparseMap.set(sparseMap, 0, "a")
      SparseMap.set(sparseMap, 1, "b")
      SparseMap.set(sparseMap, 0, "c")
      SparseMap.set(sparseMap, 1, "d")
      expect(SparseMap.get(sparseMap, 0)).toBe("c")
      expect(SparseMap.get(sparseMap, 1)).toBe("d")
      expect(sparseMap.size).toBe(2)
    })
  })

  describe("remove", () => {
    it("removes the entry of the specified key", () => {
      const sparseMap = SparseMap.make(["a", "b", "c"])
      SparseMap.remove(sparseMap, 1)
      expect(SparseMap.get(sparseMap, 0)).toBe("a")
      expect(SparseMap.get(sparseMap, 1)).toBe(undefined)
      expect(SparseMap.get(sparseMap, 2)).toBe("c")
      expect(sparseMap.size).toBe(2)
    })
    it("does not alter the SparseMap when called with a non-existing key", () => {
      const sparseMap = SparseMap.make(["a", , "c"])
      SparseMap.remove(sparseMap, 1)
      expect(SparseMap.get(sparseMap, 0)).toBe("a")
      expect(SparseMap.get(sparseMap, 1)).toBe(undefined)
      expect(SparseMap.get(sparseMap, 2)).toBe("c")
      expect(sparseMap.size).toBe(2)
    })
  })

  describe("forEach", () => {
    it("executes a callback function with the value and key of each entry in the SparseMap", () => {
      const data: [number, string][] = [
        [0, "a"],
        [10_100, "b"],
        [9, "c"],
        [23, "d"],
        [1_000_000, "e"],
        [34, "f"],
      ]
      const entries: [number, string][] = []
      const sparseMap = SparseMap.make(
        data.reduce((a, [key, value]) => {
          a[key] = value
          return a
        }, [] as string[]),
      )
      SparseMap.forEach(sparseMap, (value, key) => entries.push([key, value]))
      expect(entries).toEqual(data.sort(([keyA], [keyB]) => keyA - keyB))
    })
  })
})
