import { attach } from "../../src/entity"
import { makeQuery } from "../../src/query"
import { makeRegistry } from "../../src/registry"
import { makePerf, makePerfOnce } from "../perf"
import { Body } from "./schema"

const registry = makeRegistry(10_000_000)
const bodies = makeQuery(registry, Body)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 10_000_000; i++) {
    attach(registry, i, Body, [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ])
  }
})

export const iter = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p.x[i] += v.x[i]
      p.y[i] += v.y[i]
      p.z[i] += v.z[i]
    }
  }
})