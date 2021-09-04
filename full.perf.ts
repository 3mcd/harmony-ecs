import { makeQuery } from "./src/query"
import { makeRegistry } from "./src/registry"
import { formats, makeBinarySchema } from "./src/schema"

const registry = makeRegistry(10_000_000)
const Vector3 = { x: formats.float64, y: formats.float64, z: formats.float64 }
const Position = makeBinarySchema(Vector3)
const Velocity = makeBinarySchema(Vector3)
const bodies = makeQuery(registry, [Position, Velocity])

let steps = 1000

console.time("iter")
for (let i = 0; i < steps; i++) {
  for (const [entities, [p, v]] of bodies) {
    for (let i = 0; i < entities.length; i++) {
      p.x[i] += v.x[i]
      p.y[i] += v.y[i]
      p.z[i] += v.z[i]
    }
  }
}
console.timeEnd("iter")
