import * as Harmony from "../lib/src"
import { isEqual, isSupersetOf } from "../lib/src/type"

describe("query counts", () => {
  const ENTITY_COUNT = 1_500
  const world = Harmony.makeWorld(ENTITY_COUNT)

  const A = Harmony.makeBinarySchema(world, {})
  const B = Harmony.makeBinarySchema(world, {})
  const C = Harmony.makeBinarySchema(world, {})
  const D = Harmony.makeBinarySchema(world, {})
  const E = Harmony.makeBinarySchema(world, {})
  const F = Harmony.makeBinarySchema(world, {})

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

  const queries = types.map(type => Harmony.makeQuery(world, type))
  const entitiesPerType = ENTITY_COUNT / types.length

  types.forEach(type => {
    for (let i = 0; i < entitiesPerType; i++) Harmony.makeEntity(world, type)
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
        const [entities] = query[i]
        count += entities.length
      }
      expect(count).toBe(expectedEntityCounts[i])
    })
  })
})
