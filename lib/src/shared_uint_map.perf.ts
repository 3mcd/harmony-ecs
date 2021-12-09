import * as Entity from "./entity"
import * as UintMap from "./shared_uint_map"
import * as Type from "./type"
import { performance } from "perf_hooks"

let map = new Map()
let uintMap = UintMap.make(1_000_000)
let hashes = []
for (let i = 0; i < 1_000_000; i++) {
  let typeHash = Type.hash([i as Entity.Id])
  hashes.push(typeHash)
}

let start: number

console.log("1m UintMap writes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  UintMap.set(uintMap, hashes[i], i)
}
console.log(performance.now() - start)

console.log("1m Map writes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  map.set(hashes[i], i)
}
console.log(performance.now() - start)

console.log("1m UintMap reads")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  UintMap.get(uintMap, hashes[i])
}
console.log(performance.now() - start)

console.log("1m Map reads")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  map.get(hashes[i])
}
console.log(performance.now() - start)

console.log("1m UintMap deletes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  UintMap.remove(uintMap, hashes[i])
}
console.log(performance.now() - start)

console.log("1m Map deletes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  map.delete(hashes[i])
}
console.log(performance.now() - start)
