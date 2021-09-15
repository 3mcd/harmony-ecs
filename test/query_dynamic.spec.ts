import { formats, makeBinarySchema, makeEntity, makeQuery, makeWorld } from "../lib/src"

describe("query_dynamic", () => {
  it("updates dynamic queries with newly created archetypes", () => {
    const world = makeWorld(4)
    const A = makeBinarySchema(world, formats.float64)
    const B = makeBinarySchema(world, formats.float64)
    const C = makeBinarySchema(world, formats.float64)
    const D = makeBinarySchema(world, formats.float64)
    const E = makeBinarySchema(world, formats.float64)
    const qab = makeQuery(world, [A, B])
    const qcd = makeQuery(world, [C, D])
    const qce = makeQuery(world, [C, E])

    makeEntity(world, [A, B], [0, 1])
    makeEntity(world, [A, B, C], [0, 1, 2])
    makeEntity(world, [A, B, C, D], [0, 1, 2, 3])
    makeEntity(world, [A, B, C, E], [0, 1, 2, 4])

    expect(qab).toHaveLength(4)
    expect(qcd).toHaveLength(1)
    expect(qce).toHaveLength(1)
  })
})
