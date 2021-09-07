import { make, makeQuery, makeSchema, makeWorld } from "../../../lib/dist"
import { makePerf, makePerfOnce } from "../perf"
import { Vector3 } from "./types"

const world = makeWorld(5_000_000)
const Position = makeSchema(world, Vector3)
const Velocity = makeSchema(world, Vector3)
const Body = [Position, Velocity] as const
const bodies = makeQuery(world, Body)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 5_000_000; i++) {
    make(world, Body, [
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
