import {
  formats,
  makeBinarySchema,
  makeEntity,
  makeQuery,
  makeWorld,
  not,
  set,
  unset,
} from "../lib/src"

describe("add_remove", () => {
  it("transitions entities between archetypes", () => {
    const ENTITY_COUNT = 2
    const world = makeWorld(ENTITY_COUNT)
    const A = makeBinarySchema(world, formats.float64)
    const B = makeBinarySchema(world, formats.float64)
    const qa = makeQuery(world, [A], not([B]))
    const qab = makeQuery(world, [A, B])

    for (let i = 0; i < ENTITY_COUNT; i++) {
      makeEntity(world, [A])
    }

    for (let i = 0; i < qa.length; i++) {
      const [e] = qa[i]!
      for (let j = e.length - 1; j >= 0; j--) {
        set(world, e[j]!, B)
      }
    }

    let qaCountPreUnset = 0
    for (let i = 0; i < qa.length; i++) {
      qaCountPreUnset += qa[i]![0].length
    }

    let qabCountPreUnset = 0
    for (let i = 0; i < qab.length; i++) {
      qabCountPreUnset += qab[i]![0].length
    }

    for (let i = 0; i < qab.length; i++) {
      const [e] = qab[i]!
      for (let j = e.length - 1; j >= 0; j--) {
        unset(world, e[j]!, B)
      }
    }

    let qaCountPostUnset = 0
    for (let i = 0; i < qa.length; i++) {
      qaCountPostUnset += qa[i]![0].length
    }

    let qabCountPostUnset = 0
    for (let i = 0; i < qab.length; i++) {
      qabCountPostUnset += qab[i]![0].length
    }

    for (let i = 0; i < qa.length; i++) {
      const [e] = qa[i]!
      for (let j = e.length - 1; j >= 0; j--) {
        set(world, e[j]!, B)
      }
    }

    let qaCountPostReset = 0
    for (let i = 0; i < qa.length; i++) {
      qaCountPostReset += qa[i]![0].length
    }

    let qabCountPostReset = 0
    for (let i = 0; i < qa.length; i++) {
      qabCountPostReset += qab[i]![0].length
    }

    expect(qaCountPreUnset).toBe(0)
    expect(qabCountPreUnset).toBe(ENTITY_COUNT)
    expect(qaCountPostUnset).toBe(ENTITY_COUNT)
    expect(qabCountPostUnset).toBe(0)
    expect(qaCountPostReset).toBe(0)
    expect(qabCountPostReset).toBe(ENTITY_COUNT)
  })
})
