import * as World from "./world"
import * as Schema from "./schema"
import * as Entity from "./entity"

describe("World", () => {
  let world: World.Struct

  beforeEach(() => (world = World.make(10)))

  describe("make", () => {
    it("creates a world with a configurable entity size", () => {
      const size = 8
      const world = World.make(size)
      expect(world.size).toBe(size)
    })
    it("starts entity id counter at 0", () => {
      expect(world.entityHead).toBe(0)
    })
  })

  describe("registerSchema", () => {
    it("registers a schema with the world", () => {
      const id = 1
      const schema: Schema.NativeObjectSchema = {
        id,
        kind: Schema.SchemaKind.NativeObject,
        shape: {},
      }
      World.registerSchema(world, id, schema)
      expect(World.findSchemaById(world, id)).toBe(schema)
    })
  })

  describe("getEntityArchetype", () => {
    it("returns an entity's archetype", () => {
      const A = Schema.make(world, {})
      const entity = Entity.make(world, [A])
      const archetype = World.getEntityArchetype(world, entity)
      expect(archetype.type).toEqual([A])
    })
    it("throws when entity does not exist", () => {
      expect(() => World.getEntityArchetype(world, 9)).toThrow()
    })
  })

  describe("tryGetEntityArchetype", () => {
    it("returns undefined when entity does not exist", () => {
      expect(World.tryGetEntityArchetype(world, 9)).toBeUndefined()
    })
  })

  describe("setEntityArchetype", () => {
    it("associates an entity with an archetype", () => {
      const entity = Entity.reserve(world)
      World.setEntityArchetype(world, entity, world.rootArchetype)
      expect(World.getEntityArchetype(world, entity)).toBe(world.rootArchetype)
    })
  })

  describe("unsetEntityArchetype", () => {
    it("disassociates an entity from an archetype", () => {
      const entity = Entity.reserve(world)
      World.setEntityArchetype(world, entity, world.rootArchetype)
      World.unsetEntityArchetype(world, entity)
      expect(World.tryGetEntityArchetype(world, entity)).toBe(undefined)
    })
  })
})
