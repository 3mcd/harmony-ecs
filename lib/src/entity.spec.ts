import * as World from "./world"
import * as Entity from "./entity"
import * as Schema from "./schema"
import * as Format from "./format"

describe("Entity", () => {
  describe("make", () => {
    it("makes an entity with configured components", () => {
      const world = World.make(1)
      const Type = [Schema.make(world, Format.uint8)]
      const entity = Entity.make(world, Type)
      expect(Entity.has(world, entity, Type)).toBe(true)
    })
  })

  describe("get", () => {
    it("returns a slice of entity component data", () => {
      const world = World.make(1)
      const Type = [
        Schema.make(world, { squad: Format.uint8 }),
        Schema.makeTag(world),
        Schema.makeBinary(world, Format.uint8),
        Schema.makeBinary(world, { x: Format.float64, y: Format.float64 }),
      ]
      const entity = Entity.make(world, Type)
      const data = [{ squad: 0 }, undefined, 0, { x: 0, y: 0 }]
      expect(Entity.get(world, entity, Type)).toEqual(data)
    })
  })

  describe("set", () => {
    it("updates entity component data", () => {
      const world = World.make(1)
      const Type = [
        Schema.make(world, { squad: Format.uint8 }),
        Schema.makeTag(world),
        Schema.makeBinary(world, Format.uint8),
        Schema.makeBinary(world, { x: Format.float64, y: Format.float64 }),
      ]
      const entity = Entity.make(world, Type)
      const data = [{ squad: 1 }, , 9, { x: 10, y: 11 }]
      Entity.set(world, entity, Type, data)
      expect(Entity.get(world, entity, Type)).toEqual(data)
    })
    it("adds new components", () => {
      const world = World.make(1)
      const TypePrev = [Schema.make(world, Format.uint8)]
      const TypeNext = [...TypePrev, Schema.make(world, Format.uint8)]
      const entity = Entity.make(world, TypePrev)
      expect(Entity.has(world, entity, TypePrev)).toBe(true)
      expect(Entity.has(world, entity, TypeNext)).toBe(false)
      Entity.set(world, entity, TypeNext)
      expect(Entity.has(world, entity, TypePrev)).toBe(true)
      expect(Entity.has(world, entity, TypeNext)).toBe(true)
    })
    it("throws an error if the entity does not exist", () => {
      const world = World.make(1)
      const Type = [Schema.make(world, Format.uint8)]
      expect(() => Entity.set(world, 99, Type)).toThrow()
    })
  })

  describe("unset", () => {
    it("removes entity components", () => {
      const world = World.make(1)
      const TypePrev = [
        Schema.make(world, Format.uint8),
        Schema.make(world, Format.uint8),
      ]
      const TypeRemove = TypePrev.slice(0, 1)
      const TypeFinal = TypePrev.slice(1)
      const entity = Entity.make(world, TypePrev)
      Entity.unset(world, entity, TypeRemove)
      expect(Entity.has(world, entity, TypePrev)).toBe(false)
      expect(Entity.has(world, entity, TypeFinal)).toBe(true)
    })
    it("throws an error if the entity does not exist", () => {
      const world = World.make(1)
      const Type = [Schema.make(world, Format.uint8)]
      expect(() => Entity.set(world, 99, Type)).toThrow()
    })
  })

  describe("destroy", () => {
    it("removes all entity components", () => {
      const world = World.make(1)
      const Type = [Schema.make(world, Format.uint8), Schema.make(world, Format.float64)]
      const entity = Entity.make(world, Type)
      Entity.destroy(world, entity)
      expect(Entity.tryHas(world, entity, Type)).toBe(false)
    })
    it("throws an error if the entity does not exist", () => {
      const world = World.make(1)
      expect(() => Entity.destroy(world, 99)).toThrow()
    })
  })
})
