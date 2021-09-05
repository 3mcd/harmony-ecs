# harmony-ecs

The beginnings of an archetypal ECS with support for object components, binary components (via TypedArrays) and third-party libraries.

I wrote a short article that describes the motivation for this project called _[ECS in JS – Storage Mechanisms](https://crablike.hashnode.dev/ecs-in-js-storage-mechanisms)_.

```ts
import * as Harmony from "./lib/dist"

const Vector2 = {
  x: Harmony.formats.float64,
  y: Harmony.formats.float64,
}
const Position = Harmony.makeSchema(Vector2)
const Velocity = Harmony.makeBinarySchema(Vector2)
const registry = Harmony.makeRegistry(1_000_000)
const Kinetic = [Position, Velocity] as const
const kinetic = Harmony.makeQuery(registry, Kinetic)

for (let i = 0; i < 1_000_000; i++) {
  Harmony.attach(registry, i, Kinetic)
}

for (const [entities, [p, v]] of kinetic) {
  for (let i = 0; i < entities.length; i++) {
      p[i].x += v.x[i]
      p[i].y += v.y[i]
  }
}
```

## Performance Tests

Run the performance test suite using `npm run perf:node` or `npm perf:browser`. Example output:

```
iterBinary
----------
iter
iterations 100
┌─────────┬────────────┐
│ (index) │   Values   │
├─────────┼────────────┤
│ average │ '12.46 ms' │
│ median  │ '12.03 ms' │
│   min   │ '11.71 ms' │
│   max   │ '18.76 ms' │
└─────────┴────────────┘
```