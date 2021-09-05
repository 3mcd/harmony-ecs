# harmony-ecs

The beginnings of an archetypal ECS with support for object components, binary components (via TypedArrays) and third-party libraries.

```ts
import * as Harmony from "lib/dist"
const Vector2 = {
  x: Harmony.float64,
  y: Harmony.float64,
}
const Position = Harmony.makeSchema(Vector2)
const Velocity = Harmony.makeBinarySchema(Vector2)
const registry = Harmony.makeRegistry(1_000_000)
const Kinetic = [Position, Velocity] as const
const kinetic = Harmony.makeQuery(registry, Kinetic)

for (let i = 0; i < 1_000_000) {
  attach(registry, i, Kinetic)
}

for (const [entities, [p, v]] of kinetic) {
  for (let i = 0; i < entities.length; i++) {
      p[i].x += v.x[i]
      p[i].y += v.y[i]
  }
}
```