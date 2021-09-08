import { invariant } from "./debug"
import { Entity } from "./entity"
import {
  AnySchema,
  BinarySchema,
  Format,
  isBinarySchema,
  isFormat,
  NativeSchema,
  SchemaId,
  ShapeOf,
} from "./schema"
import { InstanceOf } from "./types"
import { World } from "./world"

export type Type = ReadonlyArray<SchemaId>

/**
 * an archetype table column which stores entity data in typed arrays
 * @example <caption>primitive element</caption>
 * Uint32Array
 * @example
 * {
 *   id: Uint32Array,
 *   stats: {
 *     strength: Uint16Array,
 *     charisma: Uint16Array,
 *   }
 * }
 */
type BinaryColumnOf<$Shape extends ShapeOf<BinarySchema>> = $Shape extends Format
  ? InstanceOf<$Shape["binary"]>
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? InstanceOf<$Shape[K]["binary"]>
        : never
    }

/**
 * an archetype table column which stores entity data in arrays of built-in
 * types (i.e. objects and IEEE 754 float64)
 *
 * @example
 * [0, 1, 2]
 * @example
 * [
 *   { id: 0, stats: { strength: 10 } },
 *   { id: 1, stats: { strength: 99 } },
 * ]
 */
type NativeColumnOf<$Shape extends ShapeOf<NativeSchema>> = $Shape extends Format
  ? number[]
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? number
        : $Shape[K] extends ShapeOf<NativeSchema>
        ? NativeColumnOf<$Shape[K]>
        : never
    }[]

/**
 * pivot on a schema's storage type (binary or native) to produce an
 * appropriate archetype column
 */
export type ArchetypeColumnOf<$Schema extends AnySchema> = $Schema extends BinarySchema
  ? BinaryColumnOf<ShapeOf<$Schema>>
  : $Schema extends NativeSchema
  ? NativeColumnOf<ShapeOf<$Schema>>
  : never

/**
 * entity-component storage
 */
export type ArchetypeTable<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId<infer $Schema>
    ? ArchetypeColumnOf<$Schema>
    : never
}

/**
 * a collection of entities which share components of the same type
 */
export type Archetype<$Type extends Type = Type> = {
  entities: Entity[]
  entityIndex: number[]
  type: $Type
  table: ArchetypeTable<$Type>
  layout: number[]
  length: number
  edgesSet: Archetype[]
  edgesUnset: Archetype[]
}

/**
 * derive the shape of a value needed to configure (e.g. insert) a binary
 * component from a `BinarySchema`
 */
export type BinaryDataOf<$Shape extends ShapeOf<BinarySchema>> = $Shape extends Format
  ? number
  : { [K in keyof $Shape]: number }

/**
 * derive the shape of a native component from a `NativeSchema`
 */
export type NativeDataOf<$Shape extends ShapeOf<NativeSchema>> = $Shape extends Format
  ? number
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? number
        : $Shape[K] extends ShapeOf<NativeSchema>
        ? NativeDataOf<$Shape[K]>
        : never
    }

export type DataOf<$Shape extends ShapeOf<AnySchema>> =
  $Shape extends ShapeOf<BinarySchema>
    ? BinaryDataOf<$Shape>
    : $Shape extends ShapeOf<NativeSchema>
    ? NativeDataOf<$Shape>
    : never

/**
 * derive a tuple of component shapes by mapping the schema of an archetype
 * type
 */
export type ArchetypeDataOf<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId<infer $Schema>
    ? DataOf<ShapeOf<$Schema>>
    : never
}

const ArrayBufferConstructor = globalThis.SharedArrayBuffer ?? globalThis.ArrayBuffer

function makeArchetypeColumn<$Schema extends AnySchema>(
  schema: $Schema,
  size: number,
): ArchetypeColumnOf<$Schema> {
  if (isBinarySchema(schema)) {
    if (isFormat(schema.shape)) {
      // binary & simple
      const buffer = new ArrayBufferConstructor(
        size * schema.shape.binary.BYTES_PER_ELEMENT,
      )
      return new schema.shape.binary(buffer) as ArchetypeColumnOf<$Schema>
    } else {
      // binary & complex
      // map each member node to a typed array
      return Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new ArrayBufferConstructor(
          size * memberNode.binary.BYTES_PER_ELEMENT,
        )
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {} as ArchetypeColumnOf<$Schema>)
    }
  } else {
    // native
    return Array(size) as ArchetypeColumnOf<$Schema>
  }
}

function makeArchetypeTable<$Type extends Type>(
  world: World,
  type: $Type,
): ArchetypeTable<$Type> {
  // TODO(3mcd): unsure how to get TypeScript to agree with this without
  // casting to unknown
  return type.map(id =>
    makeArchetypeColumn(world.schemaIndex[id], world.size),
  ) as unknown as ArchetypeTable<$Type>
}

export function makeRootArchetype(): Archetype<[]> {
  const entities: Entity[] = []
  const entityIndex: number[] = []
  const table: ArchetypeTable<[]> = []
  return {
    length: 0,
    entities,
    entityIndex,
    edgesSet: [],
    edgesUnset: [],
    layout: [],
    type: [],
    table,
  }
}

export function makeArchetype<$Type extends Type>(
  world: World,
  type: $Type,
): Archetype<$Type> {
  invariantTypeNormalized(type)
  const entities: Entity[] = []
  const entityIndex: number[] = Array(world.size)
  const table = makeArchetypeTable(world, type)
  const layout: number[] = []
  for (let i = 0; i < type.length; i++) {
    layout[type[i]] = i
  }
  return {
    length: 0,
    entities,
    entityIndex,
    edgesSet: [],
    edgesUnset: [],
    layout,
    type,
    table,
  }
}

export function insertIntoArchetype<$Type extends Type>(
  world: World,
  archetype: Archetype<$Type>,
  entity: Entity,
  data: ArchetypeDataOf<$Type>,
) {
  const length = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const id = archetype.type[i]
    const schema = world.schemaIndex[id]
    if (isBinarySchema(schema)) {
      const { shape } = schema
      if (isFormat(shape)) {
        // binary & simple
        archetype.table[i][length] = data[i]
      } else {
        // binary & complex
        for (const prop in shape) {
          archetype.table[i][prop][length] = data[i][prop]
        }
      }
    } else {
      // native
      archetype.table[i][length] = data[i]
    }
    archetype.entities[length] = entity
    archetype.entityIndex[entity] = length
    archetype.length++
  }
}

export function removeFromArchetype<$Type extends Type>(
  world: World,
  archetype: Archetype<$Type>,
  entity: number,
) {
  const index = archetype.entityIndex[entity]
  const head = archetype.entities.pop()
  const pop = index === archetype.length - 1

  if (pop) {
    // entity was head
    for (let i = 0; i < archetype.type.length; i++) {
      const id = archetype.type[i]
      const schema = world.schemaIndex[id]
      const column = archetype.table[i]
      if (isBinarySchema(schema)) {
        if (isFormat(schema.shape)) {
          column[index] = 0
        } else {
          for (const key in schema.shape) {
            column[key][index] = 0
          }
        }
      } else {
        column.pop()
      }
    }
  } else {
    const moved = archetype.length - 1
    for (let i = 0; i < archetype.type.length; i++) {
      const id = archetype.type[i]
      const schema = world.schemaIndex[id]
      const column = archetype.table[i]
      if (isBinarySchema(schema)) {
        if (isFormat(schema.shape)) {
          const value = column[moved]
          column[moved] = 0
          column[index] = value
        } else {
          for (const key in schema.shape) {
            const value = column[key][moved]
            column[key][moved] = 0
            column[key][index] = value
          }
        }
      } else {
        column[index] = column.pop()
      }
    }
    archetype.entities[index] = head
    archetype.entityIndex[head] = index
  }

  archetype.entityIndex[entity] = -1
  archetype.length--
}

export function moveToArchetype(
  world: World,
  prev: Archetype,
  next: Archetype,
  entity: number,
  schema?: AnySchema,
  data?: unknown,
) {
  if (prev.entityIndex[entity] === prev.length - 1) {
    moveToArchetypePop(world, prev, next, entity, schema, data)
  } else {
    moveToArchetypeSwap(world, prev, next, entity, schema, data)
  }
}

export function moveToArchetypeSwap(
  world: World,
  prev: Archetype,
  next: Archetype,
  entity: number,
  schema?: AnySchema,
  data?: unknown,
) {
  const nextType = next.type
  const prevType = prev.type
  const prevEnd = next.length - 1
  const prevIndex = prev.entityIndex[entity]
  const set = prevType.length < nextType.length

  let i = 0
  let j = 0

  for (; i < prevType.length; i++) {
    const prevId = prevType[i]
    const nextId = nextType[j]
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    const schema = world.schemaIndex[prevId]
    const hit = prevId === nextId
    if (isBinarySchema(schema)) {
      if (isFormat(schema.shape)) {
        if (hit) nextColumn[next.length] = prevColumn[prevIndex]
        prevColumn[prevIndex] = prevColumn[prevEnd]
        prevColumn[prevEnd] = 0
      } else {
        for (const key in schema.shape) {
          const array = prevColumn[key]
          if (hit) nextColumn[next.length] = array[prevIndex]
          prevColumn[key][prevIndex] = prevColumn[key][prevEnd]
          prevColumn[key][prevEnd] = 0
        }
      }
    } else {
      const data = prevColumn.pop()
      if (hit) nextColumn[next.length] = data
      prevColumn[prevIndex] = data
    }
    if (hit) j++
  }

  if (set) {
    invariant(schema !== undefined)
    const nextColumn = next.table[next.layout[schema.id]]
    if (isBinarySchema(schema)) {
      if (isFormat(schema.shape)) {
        nextColumn[next.length] = data
      } else {
        for (const key in schema.shape) {
          nextColumn[key][next.length] = data[key]
        }
      }
    } else {
      nextColumn[next.length] = data
    }
  }
  next.entities[next.length] = entity
  next.entityIndex[entity] = next.length
  next.length++
  prev.entities[prevIndex] = prev.entities.pop()
  prev.entityIndex[entity] = prevIndex
  prev.length--
}

export function moveToArchetypePop(
  world: World,
  prev: Archetype,
  next: Archetype,
  entity: number,
  schema?: AnySchema,
  data?: unknown,
) {
  const nextType = next.type
  const prevType = prev.type
  const prevIndex = prev.entityIndex[entity]
  const set = prevType.length < nextType.length

  prev.entities.pop()

  let i = 0
  let j = 0

  for (; i < prevType.length; i++) {
    const prevId = prevType[i]
    const nextId = nextType[j]
    const prevColumn = prev.table[i]
    const nextColumn = next.table[j]
    const schema = world.schemaIndex[prevId]
    const hit = prevId === nextId
    if (isBinarySchema(schema)) {
      if (isFormat(schema.shape)) {
        if (hit) nextColumn[next.length] = prevColumn[prevIndex]
        // TODO(3mcd): this can be optimized, we know `move` ahead of time
        prevColumn[prevIndex] = 0
      } else {
        for (const key in schema.shape) {
          const array = prevColumn[key]
          if (hit) nextColumn[next.length] = array[prevIndex]
          prevColumn[key][prevIndex] = 0
        }
      }
    } else {
      const data = prevColumn.pop()
      if (hit) nextColumn[next.length] = data
    }
    if (hit) j++
  }

  if (set) {
    invariant(schema !== undefined)
    const nextColumn = next.table[next.layout[schema.id]]
    if (isBinarySchema(schema)) {
      if (isFormat(schema.shape)) {
        nextColumn[next.length] = data
      } else {
        for (const key in schema.shape) {
          nextColumn[key][next.length] = data[key]
        }
      }
    } else {
      nextColumn[next.length] = data
    }
  }
  next.entities[next.length] = entity
  next.entityIndex[entity] = next.length
  next.length++
  prev.entityIndex[entity] = -1
  prev.length--
}

export function grow(archetype: Archetype) {}

export function normalizeType(type: Type) {
  return Object.freeze(type.slice().sort((a, b) => a - b))
}

export function invariantTypeNormalized(type: Type) {
  for (let i = 0; i < type.length - 1; i++) {
    if (type[i] > type[i + 1]) {
      throw new TypeError("abnormal type")
    }
  }
}

export function isSupersetOf(type: Type, subset: Type) {
  let i = 0
  let j = 0
  if (type.length < subset.length) {
    return false
  }
  while (i < type.length && j < subset.length) {
    const typeId = type[i]
    const subsetTypeId = subset[j]
    if (typeId < subsetTypeId) {
      i++
    } else if (typeId === subsetTypeId) {
      i++
      j++
    } else {
      return false
    }
  }
  return j === subset.length
}

export function makeTypeHash(type: Type) {
  let buckets = 97
  let hash = type.length % buckets
  for (let i = 0; i < type.length; i++) {
    hash = (hash + type[i]) % buckets
  }
  return hash
}
