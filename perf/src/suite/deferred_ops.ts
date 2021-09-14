import {
  makeBinarySchema,
  makeEntity,
  makeEntityManager,
  makeQuery,
  makeWorld,
} from "../../../lib/src"
import { applyDeferredOps, deferSet } from "../../../lib/src/entity_manager"
import { makePerfOnce } from "../perf"
import { Vector3 } from "./types"

const world = makeWorld(1_000_000)
const Position = makeBinarySchema(world, Vector3)
const Velocity = makeBinarySchema(world, Vector3)
const points = makeQuery(world, [Position] as const)
const manager = makeEntityManager()

for (let i = 0; i < 1_000_000; i++) {
  makeEntity(world, [Position])
}

export const a_store = makePerfOnce(() => {
  for (let i = 0; i < points.length; i++) {
    const [e] = points[i]
    for (let j = 0; j < e.length; j++) {
      deferSet(manager, e[j], Velocity)
    }
  }
})

export const b_apply = makePerfOnce(() => applyDeferredOps(world, manager))
