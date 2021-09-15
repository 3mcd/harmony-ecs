import {
  makeBinarySchema,
  makeEntity,
  makeQuery,
  makeSchema,
  makeWorld,
} from "../../../lib/src"
import { makePerf, makePerfOnce } from "../perf"
import { Vector3 } from "./types"

const world = makeWorld(1_000_000)
const Position = makeBinarySchema(world, Vector3)
const Velocity = makeSchema(world, Vector3)
const Body = [Position, Velocity] as const
const bodies = makeQuery(world, Body)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 1_000_000; i++) {
    makeEntity(world, Body, [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ])
  }
})

export const iter = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p.x[i] += v[i]!.x
      p.y[i] += v[i]!.y
      p.z[i] += v[i]!.z
    }
  }
})

export const iterUpdateNative = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      v[i]!.x += p.x[i]!
      v[i]!.y += p.y[i]!
      v[i]!.z += p.z[i]!
    }
  }
})
