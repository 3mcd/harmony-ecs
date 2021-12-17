import * as S from "./shared_sparse_set"

describe("sss", () => {
  describe("get", () => {
    it("returns a DataView at the key's value offset", () => {
      let set = S.make(5, 4, 1, 1)
      let entries = [
        [3, 0xffffff],
        [55, 0xfffff],
        [211, 0xffff],
        [5671, 0xfff],
        [74621, 0xff],
      ]
      for (let i = 0; i < entries.length; i++) {
        let [k, v] = entries[i]
        S.add(set, k).setUint32(0, v)
      }
      for (let i = 0; i < entries.length; i++) {
        let [k, v] = entries[i]
        expect(S.get(set, k)!.getUint32(0)).toBe(v)
      }
    })
  })

  describe("add", () => {
    it("grows the set's storage when the number of entries surpasses the initial size", () => {
      let set = S.make(2, 1)
      for (let i = 0; i < 255; i++) {
        S.add(set, i).setUint8(0, i)
      }
      for (let i = 0; i < 255; i++) {
        expect(S.get(set, i)!.getUint8(0)).toBe(i)
      }
    })
  })
})
