import { DataSet } from "vis-data"
import { Network, Edge } from "vis-network"
import * as Harmony from "../../../lib/src"
import { makeBinarySchema, makeEntity, makeWorld, World } from "../../../lib/src"
import { Archetype } from "../../../lib/src/archetype"
import { makePerfOnce } from "../perf"

function makeFixture() {
  const world = makeWorld(1_000_000)

  const A = makeBinarySchema(world, {})
  const B = makeBinarySchema(world, {})
  const C = makeBinarySchema(world, {})
  const D = makeBinarySchema(world, {})
  const E = makeBinarySchema(world, {})
  const F = makeBinarySchema(world, {})

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

let world: World
let e = 0

for (let i = 0; i < 10; i++) {
  const fixture = makeFixture()
  world = fixture.world
  const start = performance.now()
  for (let i = fixture.types.length - 1; i >= 0; i--) {
    const count = Math.random() * 100
    for (let j = 0; j < count; j++) {
      makeEntity(world, fixture.types[i]!)
      e++
    }
  }
  const end = performance.now()
  results.push(end - start)
}

const avgTime = results.reduce((a, x) => a + x, 0) / 100

function getUniqueArchetypes(archetype: Archetype, visited = new Set<Archetype>()) {
  visited.add(archetype)
  archetype.edgesSet.forEach(a => getUniqueArchetypes(a, visited))
  return visited
}

console.log(
  `${
    getUniqueArchetypes(world!.archetypeRoot).size
  } archetype insert took ${avgTime.toFixed(2)}ms`,
)

function getColor(value: number) {
  return ["hsl(", ((1 - value) * 120).toString(10), ",100%,50%)"].join("")
}

function insertGraphData(
  archetype: Archetype,
  nodes: Set<Archetype>,
  edges: Edge[] = [],
) {
  if (nodes.has(archetype)) return
  const outer = archetype.type.toString()
  if (archetype.type.length > 0) {
    nodes.add(archetype)
  }
  archetype.edgesSet.forEach(a => {
    const inner = a.type.toString()
    edges.push({ from: outer, to: inner })
    insertGraphData(a, nodes, edges)
  })
}

if (typeof window === "object") {
  const nodes = new Set<Archetype>()
  const edges: Edge[] = []
  insertGraphData(world!.archetypeRoot, nodes, edges)
  // create a network
  const container = document.getElementById("archetypes")
  const data = {
    nodes: new DataSet(
      Array.from(nodes).map(archetype => ({
        id: archetype.type.toString(),
        label: `(${archetype.type.map(x => String.fromCharCode(65 + x))})`,
        color: archetype.real ? getColor(archetype.entities.length / 100) : "#cccccc",
      })),
    ),
    edges: new DataSet(edges),
  }
  const options = {
    layout: {
      randomSeed: 1,
      improvedLayout: true,
      hierarchical: {
        direction: "LR",
        sortMethod: "directed",
      },
    },
  }
  const network = new Network(container!, data, options)
}

export const run = makePerfOnce(() => {})
;(globalThis as any).world = world!
;(globalThis as any).Harmony = Harmony
