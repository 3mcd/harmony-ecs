# harmony-ecs

A small archetypal ECS focused on compatibility and performance. Harmony has a small footprint, making it a good set of building blocks to make a full ECS with.

I wrote a short article that describes the motivation for this project called _[ECS in JS – Storage Mechanisms](https://javelin.hashnode.dev/ecs-in-js-storage-mechanisms)_.

Harmony will eventually be incorporated into [Javelin](https://github.com/3mcd/javelin), a more feature-rich ECS focused on multiplayer game development.

## Features

- Written in TypeScript
- Hybrid struct-of-array `{ x: [0] }` and array-of-struct `[{ x: 0 }]` storage
- Fast iteration
- Fast insert/relocate via archetype graph
- Compatible with (any?) third-party library

## Examples

Below is an example of hybrid storage where a TypedArray-based `Velocity` component is used to update an object-based `Position` component:

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

Harmony does not modify objects, making it highly compatible with third-party libraries. Take the following example where an entity is composed of a Three.js mesh, Cannon.js rigid body, and some proprietary TypedArray-backed data.

```ts
const Vector3 = { x: Harmony.formats.float64 /* etc */ }
const mesh = new Three.Mesh(new Three.SphereGeometry(), new Three.MeshBasicMaterial())
const body = new Cannon.Body({ mass: 1, shape: new Cannon.Sphere(1) })
const Mesh = Harmony.makeSchema(world, { position: Vector3 })
const Body = Harmony.makeSchema(world, { position: Vector3 })
const PlayerInfo = Harmony.makeBinarySchema(world, { id: Harmony.formats.uint32 })
const Player = [Mesh, Body, PlayerInfo] as const

Harmony.make(world, Player)
```

Note that we still need to define the shape of third party objects, as seen in the `Mesh` and `Body` variables. This supplies Harmony with static type information for queries and provides the ECS with important runtime information for serialization, etc.

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
