import * as Table from "./table"
import * as Format from "./format"
import * as Registry from "./registry"
import * as Schema from "./schema"
import * as Signal from "./signal"
import { performance } from "perf_hooks"

const MAX = 1_000_100
const COUNT = 1_000_000

let signals = { onTableCreate: Signal.make(), onTableGrow: Signal.make() }
let registry = Registry.make(MAX)
let A = await Registry.makeSchema(registry, Format.uint8)
let B = await Registry.makeSchema(registry, Format.uint8)

let table = Table.make(
  [A, B],
  [
    { type: Schema.Type.Scalar, shape: Format.uint8 },
    { type: Schema.Type.Scalar, shape: Format.uint8 },
  ],
  MAX,
)

for (let i = 0; i < COUNT; i++) {
  let e = await Registry.makeEntity(registry)
  await Table.insert(table, e, [90, 91], signals)
}

let it = Table.iter(table)
let {
  entities: e,
  columns: { [A]: a, [B]: b },
} = table
let start = performance.now()

for (let i of await it()) {
  e[i]
  // @ts-ignore
  // a[i]
  // @ts-ignore
  // b[i]
}

console.log(performance.now() - start)
