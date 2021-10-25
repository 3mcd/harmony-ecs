import { formats, Entity, Schema, Query, World } from "../lib/src"

describe("add_remove", () => {
  it("transitions entities between archetypes", () => {
    const ENTITY_COUNT = 2
    const world = World.make(ENTITY_COUNT)
    const A = Schema.makeBinary(world, formats.float64)
    const B = Schema.makeBinary(world, formats.float64)
    const qa = Query.make(world, [A], Query.not([B]))
    const qab = Query.make(world, [A, B])

    for (let i = 0; i < ENTITY_COUNT; i++) {
      Entity.make(world, [A])
    }

    for (let i = 0; i < qa.length; i++) {
      const [e] = qa[i]!
      for (let j = e.length - 1; j >= 0; j--) {
        Entity.set(world, e[j]!, [B])
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
        Entity.unset(world, e[j]!, [B])
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
        Entity.set(world, e[j]!, [B])
      }
    }

    // console.log(world.rootTable.edgesSet[A]!.edgesSet[B])

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
