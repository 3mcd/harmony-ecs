# harmony-ecs

An Entity-Component-System (ECS) focused on compatibility and performance. Harmony has a small footprint, making it a good set of building blocks to create a full ECS with.

## Features

- Hybrid struct-of-array `{x: [0]}` and array-of-struct `[{x: 0}]` storage
- Scalar and complex components e.g., `1.23` and `{position: {x: 1.23}}`
- Fast iteration and mutation ([benchmarks](https://github.com/3mcd/ecs-benchmark/tree/harmony-ecs))
- Fast insert/relocate and auto-updating queries thanks to a [connected archetype graph](./graph.png)
- Compatible with third-party libraries like Three.js, Cannon, etc.

## Installation

```sh
npm install harmony-ecs
```

## Documentation

Documentation currently resides on the repository [wiki](https://github.com/3mcd/harmony-ecs/wiki).

## Examples

This repo contains examples in the [`examples`](./examples) directory. You can run each project using `npm run example:*`, where `*` is the name of an example subdirectory.

Below is a sample of Harmony's API, where a TypedArray `Velocity` component is used to update an object `Position` component:

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

for (let i = 0; i < 1_000_000; i++) {
  Harmony.makeEntity(world, Kinetic)
}

const kinetics = Harmony.makeQuery(world, Kinetic)

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
const Mesh = Harmony.makeSchema(world, { position: Vector3 })
const Body = Harmony.makeSchema(world, { position: Vector3 })
const PlayerInfo = Harmony.makeBinarySchema(world, { id: Harmony.formats.uint32 })
const Player = [Mesh, Body, PlayerInfo] as const

const mesh = new Three.Mesh(new Three.SphereGeometry(), new Three.MeshBasicMaterial())
const body = new Cannon.Body({ mass: 1, shape: new Cannon.Sphere(1) })

Harmony.makeEntity(world, Player, [mesh, body, { id: 123 }])
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
