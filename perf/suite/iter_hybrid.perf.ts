import { attach } from "../../src/entity"
import { makeQuery } from "../../src/query"
import { makeRegistry } from "../../src/registry"
import { makePerf, makePerfOnce } from "../perf"
import { BodyHybrid } from "./schema"

const registry = makeRegistry(10_000_000)
const bodies = makeQuery(registry, BodyHybrid)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 10_000_000; i++) {
    attach(registry, i, BodyHybrid, [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ])
  }
})

export const iter = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p.x[i] += v[i].x
      p.y[i] += v[i].y
      p.z[i] += v[i].z
    }
  }
})

export const iterUpdateNative = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      v[i].x += p.x[i]
      v[i].y += p.y[i]
      v[i].z += p.z[i]
    }
  }
})
