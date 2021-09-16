import { Archetype } from "../../../lib/src/archetype"
import { Edge, Network, Node } from "vis-network"
import { DataSet } from "vis-data"
import { makeEntity, makeSchema, makeWorld, Schema } from "../../../lib/src"
import { Type } from "../../../lib/src/type"

function getColor(value: number) {
  return ["hsl(", ((1 - value) * 120).toString(10), ",100%,50%)"].join("")
}

function makeTypeId(type: Type) {
  return type.join(",")
}

const $type = document.getElementById("type") as HTMLInputElement
const $network = document.getElementById("network")!
const $insert = document.getElementById("insert")!

const world = makeWorld(1_000_000)
const nodes = new DataSet([] as (Node & { count: number })[])
const edges = new DataSet([] as Edge[])
const schemas = Array(10)
  .fill(undefined)
  .map(() => makeSchema(world, {}))
const edgeIds = new Set<string>()

function maybeMakeEdge(a: Type, b: Type) {
  const from = makeTypeId(a)
  const to = makeTypeId(b)
  const id = a.length > b.length ? `${to}–${from}` : `${from}–${to}`
  if (edgeIds.has(id)) {
    return
  }
  edgeIds.add(id)
  edges.add({ id, from, to })
}

function onArchetypeInsert(archetype: Archetype) {
  const id = makeTypeId(archetype.type)
  nodes.add({ id: id, label: `(${id})`, count: 0 })
  archetype.edgesSet.forEach(({ type }) => maybeMakeEdge(archetype.type, type))
  archetype.edgesUnset.forEach(({ type }) => maybeMakeEdge(archetype.type, type))
}

world.archetypeRoot.onArchetypeInsert(onArchetypeInsert)
onArchetypeInsert(world.archetypeRoot)

let total = 0

function onInsertEntity() {
  const type = Array.from($type.value.split(/[\s,]+/).map(Number))
    .sort((a, b) => a - b)
    .map(id => schemas[id]!)
  const id = makeTypeId(type)
  makeEntity(world, type)
  const node = nodes.get(id)!
  const count = node.count + 1
  total++
  nodes.update({ id, count })
  nodes.forEach(node =>
    nodes.update({ id: node.id, color: { background: getColor(node.count / total) } }),
  )
  $type.value = ""
}

$type.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    onInsertEntity()
  }
})
$insert.addEventListener("click", onInsertEntity)

new Network(
  $network,
  {
    nodes,
    edges,
  },
  {
    physics: {
      maxVelocity: 5,
    },
  },
)

//@ts-ignore
globalThis.world = world
