import { Entity, Query, Schema, World } from "../lib/src"
import { isEqual, isSupersetOf } from "../lib/src/type"

describe("query counts", () => {
  const ENTITY_COUNT = 1_500
  const world = World.make(ENTITY_COUNT)

  const A = Schema.makeBinary(world, {})
  const B = Schema.makeBinary(world, {})
  const C = Schema.makeBinary(world, {})
  const D = Schema.makeBinary(world, {})
  const E = Schema.makeBinary(world, {})
  const F = Schema.makeBinary(world, {})

  const types = [
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

  const queries = types.map(type => Query.make(world, type))
  const entitiesPerType = ENTITY_COUNT / types.length

  types.forEach(type => {
    for (let i = 0; i < entitiesPerType; i++) Entity.make(world, type)
  })

  const expectedEntityCounts = types.map(type =>
    types.reduce(
      (a, t) => a + (isEqual(t, type) || isSupersetOf(t, type) ? entitiesPerType : 0),
      0,
    ),
  )

  it("yields correct entity counts", () => {
    queries.forEach((query, i) => {
      let count = 0
      for (let i = 0; i < query.length; i++) {
        const [entities] = query[i]!
        count += entities.length
      }
      expect(count).toBe(expectedEntityCounts[i])
    })
  })
})
