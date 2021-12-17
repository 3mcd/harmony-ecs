import { performance } from "perf_hooks"
import * as S from "./shared_sparse_set"

const COUNT = 1_000_000

let map = new Map()
let sset = S.make(COUNT, 2, 0.7, 1)
let hashes = []
for (let i = 0; i < COUNT; i++) {
  let typeHash = i
  hashes.push(typeHash)
}

let start: number

console.log("1m sparse writes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  S.add(sset, hashes[i])
}
console.log(performance.now() - start)

console.log("1m map writes")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  map.set(hashes[i], i)
}
console.log(performance.now() - start)

console.log("1m sparse reads")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  S.get(sset, hashes[i])
}
console.log(performance.now() - start)

console.log("1m map reads")
start = performance.now()
for (let i = 0; i < hashes.length; i++) {
  map.get(hashes[i])
}
console.log(performance.now() - start)

// console.log("1m sparse deletes")
// start = performance.now()
// for (let i = 0; i < hashes.length; i++) {
//   S.remove(set, hashes[i])
// }
// console.log(performance.now() - start)

// console.log("1m map deletes")
// start = performance.now()
// for (let i = 0; i < hashes.length; i++) {
//   map.delete(hashes[i])
// }
// console.log(performance.now() - start)
