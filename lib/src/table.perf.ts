import * as Table from "./table"
import * as Format from "./format"
import { performance } from "perf_hooks"

const COUNT = 1_000_000

let table = Table.make([Format.uint8, Format.uint8] as const, COUNT)

for (let i = 0; i < COUNT; i++) {
  await Table.insert(table, [i, 99])
}

let [e, a] = table.columns
let start = performance.now()

for (let i of Table.iter(table)) {
  e[i]
  a[i]
}

// let length = table.length[0]
// for (let i = length - 1; i >= 0; i--) {
//   e[i]
//   a[i]
// }

console.log(performance.now() - start)
