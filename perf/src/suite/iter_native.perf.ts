import { Entity, Query, Schema, World } from "../../../lib/src"
import { makePerf, makePerfOnce } from "../perf"
import { Vector3 } from "./types"

const world = World.make(1_000_000)
const Position = Schema.make(world, Vector3)
const Velocity = Schema.make(world, Vector3)
const Body = [Position, Velocity] as const
const bodies = Query.make(world, Body)

export const insert = makePerfOnce(() => {
  for (let i = 0; i < 1_000_000; i++) {
    Entity.make(world, Body, [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ])
  }
})

export const iter = makePerf(() => {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p[i]!.x += v[i]!.x
      p[i]!.y += v[i]!.y
      p[i]!.z += v[i]!.z
    }
  }
})
