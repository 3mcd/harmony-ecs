import { Entity, Schema, World } from "../../../lib/src"
import { Table } from "../../../lib/src/archetype"
import { makePerfOnce } from "../perf"

function makeFixture() {
  const world = World.make(1_000_000)

  const A = Schema.makeBinary(world, {})
  const B = Schema.makeBinary(world, {})
  const C = Schema.makeBinary(world, {})
  const D = Schema.makeBinary(world, {})
  const E = Schema.makeBinary(world, {})
  const F = Schema.makeBinary(world, {})

  const types = [
    [A, B, C],
    [A],
    [C],
    [F],
    [A, B],
    [A, C],
    [B, C],
    [B, F],
    [A, C, E],
    [B, D, F],
    [E, F],
    [A, C, E, F],
    [B, C, D, F],
    [C, D, E, F],
    [B, C, D, E, F],
    [A, B, C, D, E, F],
  ]
  return { world, types }
}

const results: number[] = []

let world: World.World

for (let i = 0; i < 10; i++) {
  const fixture = makeFixture()
  world = fixture.world
  const start = performance.now()
  for (let i = fixture.types.length - 1; i >= 0; i--) {
    const count = Math.random() * 100
    for (let j = 0; j < count; j++) {
      Entity.make(world, fixture.types[i]!)
    }
  }
  const end = performance.now()
  results.push(end - start)
}

const avgTime = results.reduce((a, x) => a + x, 0) / 100

function getUniqueArchetypes(archetype: Table, visited = new Set<Table>()) {
  visited.add(archetype)
  archetype.edgesSet.forEach(a => getUniqueArchetypes(a, visited))
  return visited
}

console.log(
  `${getUniqueArchetypes(world!.rootTable).size} archetype insert took ${avgTime.toFixed(
    2,
  )}ms`,
)

export const run = makePerfOnce(() => {})
