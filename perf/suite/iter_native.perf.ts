import { attach } from "../../src/entity"
import { makeQuery } from "../../src/query"
import { makeRegistry } from "../../src/registry"
import { makePerf, makePerfOnce } from "../perf"
import { BodyNative } from "./schema"

const registry = makeRegistry(10_000_000)
const bodies = makeQuery(registry, BodyNative)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 10_000_000; i++) {
    attach(registry, i, BodyNative, [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ])
  }
})

export const iter = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p[i].x += v[i].x
      p[i].y += v[i].y
      p[i].z += v[i].z
    }
  }
})
