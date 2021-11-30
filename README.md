# harmony-ecs

A compatibility and performance-focused Entity-Component-System (ECS) for JavaScript.

<p>
  <img alt="NPM" src="https://img.shields.io/npm/l/harmony-ecs?style=flat-square">
  <img alt="node-current" src="https://img.shields.io/node/v/harmony-ecs?style=flat-square">
  <a href="https://codecov.io/gh/3mcd/harmony-ecs">
    <img alt="Codecov" src="https://img.shields.io/codecov/c/github/3mcd/harmony-ecs?style=flat-square">
  </a>
  <img alt="npm bundle size" src="https://img.shields.io/bundlephobia/min/harmony-ecs?style=flat-square">
</p>

## Features

- Hybrid [SoA and AoS](https://en.wikipedia.org/wiki/AoS_and_SoA) storage
- Complex, scalar, and tag components
- Fast iteration and mutation [[1]](https://github.com/ddmills/js-ecs-benchmarks) [[2]](https://github.com/noctjs/ecs-benchmark)
- Fast insert/relocate and auto-updating queries via [connected archetype graph](./graph.png)
- Compatible with third-party libraries like Three.js, Pixi, and Cannon

## Installation

```sh
npm install harmony-ecs
```

## Documentation

- [Wiki](https://github.com/3mcd/harmony-ecs/wiki)
- [API docs](https://3mcd.github.io/harmony-ecs)

## Examples

This repo contains examples in the [`examples`](./examples) directory. You can run each project using `npm run example:*`, where `*` is the name of an example subdirectory.

Below is a sample of Harmony's API, where a TypedArray `Velocity` component is used to update an object `Position` component:

```ts
import { World, Schema, Entity, Query, Format } from "harmony-ecs"

const Vector2 = {
  x: Format.float64,
  y: Format.float64,
}
const world = World.make(1_000_000)
const Position = Schema.make(world, Vector2)
const Velocity = Schema.makeBinary(world, Vector2)
const Kinetic = [Position, Velocity] as const

for (let i = 0; i < 1_000_000; i++) {
  Entity.make(world, Kinetic)
}

const kinetics = Query.make(world, Kinetic)

for (const [entities, [p, v]] of kinetics) {
  for (let i = 0; i < entities.length; i++) {
    p[i].x += v.x[i]
    p[i].y += v.y[i]
  }
}
```

Harmony does not modify objects, making it highly compatible with third-party libraries. Take the following example where an entity is composed of a Three.js mesh, Cannon.js rigid body, and some proprietary TypedArray-backed data.

```ts
const Vector3 = { x: Format.float64 /* etc */ }
const Mesh = Schema.make(world, { position: Vector3 })
const Body = Schema.make(world, { position: Vector3 })
const PlayerInfo = Schema.makeBinary(world, { id: Format.uint32 })
const Player = [Mesh, Body, PlayerInfo] as const

const mesh = new Three.Mesh(new Three.SphereGeometry(), new Three.MeshBasicMaterial())
const body = new Cannon.Body({ mass: 1, shape: new Cannon.Sphere(1) })

Entity.make(world, Player, [mesh, body, { id: 123 }])
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
