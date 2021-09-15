import { makeBinarySchema, makeEntity, makeQuery, makeWorld } from "../../../lib/src"
import { makePerf, makePerfOnce } from "../perf"
import { Vector3 } from "./types"

const world = makeWorld(1_000_000)
const Position = makeBinarySchema(world, Vector3)
const Velocity = makeBinarySchema(world, Vector3)
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
      p.x[i] += v.x[i]!
      p.y[i] += v.y[i]!
      p.z[i] += v.z[i]!
    }
  }
})
