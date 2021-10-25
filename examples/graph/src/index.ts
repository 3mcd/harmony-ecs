import { Table } from "../../../lib/src/archetype"
import { Edge, Network, Node } from "vis-network"
import { DataSet } from "vis-data"
import { Entity, Schema, World } from "../../../lib/src"
import { Type } from "../../../lib/src/type"

function getColor(value: number) {
  return ["hsl(", ((1 - value) * 120).toString(10), ",100%,50%)"].join("")
}

function makeTypeId(type: Type) {
  return type.join(",")
}

const $log = document.getElementById("log")!
const $type = document.getElementById("type") as HTMLInputElement
const $network = document.getElementById("network")!
const $insert = document.getElementById("insert")!

const world = World.make(1_000_000)
const nodes = new DataSet([] as (Node & { count: number })[])
const edges = new DataSet([] as Edge[])
const schemas = Array(10)
  .fill(undefined)
  .map(() => Schema.make(world, {}))
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

function onTableInsert(table: Table) {
  const id = makeTypeId(table.type)
  nodes.add({ id: id, label: `(${id})`, count: 0, level: table.type.length })
  table.edgesSet.forEach(({ type }) => maybeMakeEdge(table.type, type))
  table.edgesUnset.forEach(({ type }) => maybeMakeEdge(table.type, type))
}

subscribe(world.rootTable.onTableInsert, onTableInsert)
onTableInsert(world.rootTable)

let max = 0

function onInsertEntity() {
  const type = Array.from($type.value.split(/[\s,]+/).map(Number))
    .sort((a, b) => a - b)
    .map(id => schemas[id]!)
  const id = makeTypeId(type)
  Entity.make(world, type)
  const node = nodes.get(id)!
  const count = node.count + 1
  if (count > max) {
    max = count
  }
  nodes.update({ id, count })
  nodes.forEach(node =>
    nodes.update({
      id: node.id,
      color: { background: node.count > 0 ? getColor(node.count / max) : undefined },
    }),
  )
  $log.textContent += `${id}\n`
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
    nodes: {
      physics: false,
    },
    layout: {
      hierarchical: {
        // enabled: true,
        levelSeparation: 200,
        nodeSpacing: 70,
        treeSpacing: 100,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
        direction: "LR",
        sortMethod: "directed", // hubsize, directed,
      },
    },
  },
)

import * as Harmony from "../../../lib/src"
import { subscribe } from "../../../lib/src/signal"

//@ts-ignore
globalThis.world = world
// @ts-ignore
globalThis.Harmony = Harmony
