import { get, make, set, remove, forEach } from "./sparse_map"

describe("sparse_map", () => {
  it("init", () => {
    const smap = make([, , , "a"])
    expect(get(smap, 3)).toBe("a")
    expect(smap.size).toBe(1)
  })
  it("set", () => {
    const smap = make()
    set(smap, 99, "a")
    set(smap, 42, "b")
    expect(get(smap, 99)).toBe("a")
    expect(get(smap, 42)).toBe("b")
    expect(smap.size).toBe(2)
  })
  it("remove", () => {
    const smap = make()
    set(smap, 12, "c")
    set(smap, 99, "a")
    set(smap, 42, "b")
    remove(smap, 42)
    expect(get(smap, 42)).toBe(undefined)
    expect(get(smap, 99)).toBe("a")
    expect(get(smap, 12)).toBe("c")
    expect(smap.size).toBe(2)
  })
})

const arr: number[] = []
const map = new Map()
const smap = make()

console.time("map insert")
for (let i = 0; i < 2_000_000; i += 2) {
  map.set(i, i)
}
console.timeEnd("map insert")

console.time("smap insert")
for (let i = 0; i < 2_000_000; i += 2) {
  set(smap, i, i)
}
console.timeEnd("smap insert")

console.time("arr insert")
for (let i = 0; i < 2_000_000; i += 2) {
  arr[i] = i
}
console.timeEnd("arr insert")

console.time("map set")
for (let i = 0; i < 2_000_000; i += 2) {
  map.set(i, 0)
}
console.timeEnd("map set")

console.time("smap set")
for (let i = 0; i < 2_000_000; i += 2) {
  set(smap, i, 0)
}
console.timeEnd("smap set")

console.time("map get")
for (let i = 0; i < 2_000_000; i += 2) {
  map.get(i)
}
console.timeEnd("map get")

console.time("smap get")
for (let i = 0; i < 2_000_000; i += 2) {
  get(smap, i)
}
console.timeEnd("smap get")

console.time("map iter")
for (let i = 0; i < 10; i += 2) {
  map.forEach((value, key) => {})
}
console.timeEnd("map iter")

console.time("smap iter")
for (let i = 0; i < 10; i += 2) {
  forEach(smap, (value, key) => {})
}
console.timeEnd("smap iter")

console.time("arr iter")
for (let i = 0; i < 10; i += 2) {
  arr.forEach((value, key) => {})
}
console.timeEnd("arr iter")

console.time("map delete")
for (let i = 0; i < 2_000_000; i += 2) {
  map.delete(i)
}
console.timeEnd("map delete")

console.time("smap delete")
for (let i = 0; i < 2_000_000; i += 2) {
  remove(smap, i)
}
console.timeEnd("smap delete")
