/**
 * schema.ts
 */
import { types, makeBinarySchema, makeSchema } from "@javelin/ecs"

const Vector2 = {
  x: types.uint32,
  y: types.uint32,
}
const Position = makeBinarySchema(Vector2)
const Velocity = makeBinarySchema(Vector2)
const Mesh = makeSchema({
  position: Vector2,
})

/**
 * workers/physics.ts
 */
import { makeWorld, makeWorkerPipeline, useQuery } from "@javelin/ecs"
import { Position, Velocity } from "../schema"

function physics(world) {
  // worker systems may only operate on binary component data
  const bodiesOf = useQuery(Position, Velocity)
  for (const [entities, [p, v]] of bodiesOf(world)) {
    for (let i = 0; i < entities.length; i++) {
      p.x[i] += v.x[i]
      p.y[i] += v.y[i]
    }
  }
}

export default makeWorkerPipeline(physics)

/**
 * systems/render.ts
 */
import { useQuery } from "@javelin/ecs"

function render(world) {
  const drawablesOf = useQuery(Position, Mesh)
  // copy entity position to mesh, e.g. a Three.js mesh
  for (const [entities, [p, m]] of drawablesOf(world)) {
    for (let i = 0; i < entities.length; i++) {
      const mesh = m[i]
      mesh.x = p.x[i]
      mesh.y = p.y[i]
    }
  }
}

/**
 * world.ts
 */
import { makeWorld, makeStorage, makePipeline } from "@javelin/ecs"
import physics from "./workers/physics"

const world = makeWorld()
const storage = makeStorage()
const pipeline = makePipeline(render, physics)

world.step(storage, pipeline)
