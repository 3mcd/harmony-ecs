import { insertIntoArchetype, makeArchetype, removeFromArchetype } from "./archetype"
import { formats, makeBinarySchema, makeSchema } from "./schema"

function perfBinary() {
  console.log("perfBinary")
  const A = makeBinarySchema({ x: formats.float64, y: formats.float64 })
  const B = makeBinarySchema({ x: formats.float64, y: formats.float64 })
  const a = makeArchetype([A, B] as const, 10_000_000)
  console.time("insert")
  for (let i = 0; i < 10_000_000; i++) {
    insertIntoArchetype(a, i, [
      { x: i, y: i },
      { x: i + 1, y: i + 1 },
    ])
  }
  console.timeEnd("insert")
  const {
    entities,
    table: [p, v],
  } = a
  console.time("iter")
  for (let i = 0; i < entities.length; i++) {
    p.x[i] += v.x[i]
    p.y[i] += v.y[i]
  }
  console.timeEnd("iter")
  console.time("remove")
  for (let i = entities.length - 1; i >= 0; i--) {
    removeFromArchetype(a, entities[0])
  }
  console.timeEnd("remove")
}

function perfNative() {
  console.log("perfNative")
  const A = makeSchema({ x: formats.float64, y: formats.float64 })
  const B = makeSchema({ x: formats.float64, y: formats.float64 })
  const a = makeArchetype([A, B] as const, 10_000_000)
  console.time("insert")
  for (let i = 0; i < 10_000_000; i++) {
    insertIntoArchetype(a, i, [
      { x: i, y: i },
      { x: i + 1, y: i + 1 },
    ])
  }
  console.timeEnd("insert")
  const {
    entities,
    table: [p, v],
  } = a
  console.time("iter")
  for (let i = 0; i < entities.length; i++) {
    p[i].x += v[i].x
    p[i].y += v[i].y
  }
  console.timeEnd("iter")
}

function perfMixed() {
  console.log("perfMixed")
  const A = makeSchema({ x: formats.float64, y: formats.float64 })
  const B = makeBinarySchema({ x: formats.float64, y: formats.float64 })
  const a = makeArchetype([A, B] as const, 10_000_000)
  console.time("insert")
  for (let i = 0; i < 10_000_000; i++) {
    insertIntoArchetype(a, i, [
      { x: i, y: i },
      { x: i + 1, y: i + 1 },
    ])
  }
  console.timeEnd("insert")
  const {
    entities,
    table: [p, v],
  } = a
  console.time("iter")
  for (let i = 0; i < entities.length; i++) {
    p[i].x += v.x[i]
    p[i].y += v.x[i]
  }
  console.timeEnd("iter")
}

perfBinary()
perfNative()
perfMixed()
