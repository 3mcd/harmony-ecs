# harmony-ecs

A small archetypal ECS focused on compatibility and performance. Harmony has a small footprint, making it a good set of building blocks to make a full ECS with.

I wrote a short article that describes the motivation for this project called _[ECS in JS – Storage Mechanisms](https://javelin.hashnode.dev/ecs-in-js-storage-mechanisms)_.

Harmony will eventually be incorporated into [Javelin](https://github.com/3mcd/javelin), a more feature-rich ECS focused on multiplayer game development.

## Features

- Written in TypeScript
- Hybrid struct-of-array `{ x: [] }` and array-of-struct `[{ x }]` storage
- Fast iteration
- Fast insert/relocate via archetype graph
- Compatible with (any?) third-party library

## Example

```ts
import * as Harmony from "./lib/dist"

const Vector2 = {
  x: Harmony.formats.float64,
  y: Harmony.formats.float64,
}
const world = Harmony.makeWorld(1_000_000)
const Position = Harmony.makeSchema(world, Vector2)
const Velocity = Harmony.makeBinarySchema(world, Vector2)
const Kinetic = [Position, Velocity] as const
const kinetics = Harmony.makeQuery(world, Kinetic)

for (let i = 0; i < 1_000_000; i++) {
  Harmony.make(world, Kinetic)
}

for (const [entities, [p, v]] of kinetics) {
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
