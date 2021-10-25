import { formats, Schema, Entity, Query, World } from "../lib/src"

describe("query_dynamic", () => {
  it("updates dynamic queries with newly created archetypes", () => {
    const world = World.make(4)
    const A = Schema.makeBinary(world, formats.float64)
    const B = Schema.makeBinary(world, formats.float64)
    const C = Schema.makeBinary(world, formats.float64)
    const D = Schema.makeBinary(world, formats.float64)
    const E = Schema.makeBinary(world, formats.float64)
    const qab = Query.make(world, [A, B])
    const qcd = Query.make(world, [C, D])
    const qce = Query.make(world, [C, E])

    Entity.make(world, [A, B], [0, 1])
    Entity.make(world, [A, B, C], [0, 1, 2])
    Entity.make(world, [A, B, C, D], [0, 1, 2, 3])
    Entity.make(world, [A, B, C, E], [0, 1, 2, 4])

    expect(qab).toHaveLength(4)
    expect(qcd).toHaveLength(1)
    expect(qce).toHaveLength(1)
  })
})
