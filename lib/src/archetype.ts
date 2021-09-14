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
  Shape,
} from "./schema"
import { makeSignal, Signal } from "./signal"
import { invariantTypeNormalized, Type } from "./type"
import { InstanceOf } from "./types"
import { World } from "./world"

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
type BinaryColumn<$Shape extends Shape<BinarySchema>> = $Shape extends Format
  ? InstanceOf<$Shape["binary"]>
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? InstanceOf<$Shape[K]["binary"]>
        : never
    }

type NativeObjectColumn<$Shape extends Shape<NativeSchema>> = $Shape extends Format
  ? number[]
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? number
        : $Shape[K] extends Shape<NativeSchema>
        ? NativeObjectColumn<$Shape[K]>
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
type NativeColumn<$Shape extends Shape<NativeSchema>> = $Shape extends Format
  ? number[]
  : NativeObjectColumn<$Shape>[]

/**
 * pivot on a schema's storage type (binary or native) to produce an
 * appropriate archetype column
 */
export type ArchetypeColumnOf<$Schema extends AnySchema> = $Schema extends NativeSchema
  ? NativeColumn<Shape<$Schema>>
  : $Schema extends BinarySchema
  ? BinaryColumn<Shape<$Schema>>
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
  edgesSet: Archetype[]
  edgesUnset: Archetype[]
  entities: Entity[]
  entityIndex: number[]
  layout: number[]
  length: number
  onArchetypeInsert: Signal<Archetype>
  onSet: Signal<Entity>
  table: ArchetypeTable<$Type>
  type: $Type
}

/**
 * derive the shape of a value needed to configure (e.g. insert) a binary
 * component from a `BinarySchema`
 */
export type BinaryData<$Shape extends Shape<BinarySchema>> = $Shape extends Format
  ? number
  : { [K in keyof $Shape]: number }

/**
 * derive the shape of a native component from a `NativeSchema`
 */
export type NativeData<$Shape extends Shape<NativeSchema>> = $Shape extends Format
  ? number
  : {
      [K in keyof $Shape]: $Shape[K] extends Format
        ? number
        : $Shape[K] extends Shape<NativeSchema>
        ? NativeData<$Shape[K]>
        : never
    }

export type ShapeData<$Shape extends Shape<AnySchema>> =
  $Shape extends Shape<BinarySchema>
    ? BinaryData<$Shape>
    : $Shape extends Shape<NativeSchema>
    ? NativeData<$Shape>
    : never

export type Data<$SchemaId extends SchemaId> = $SchemaId extends SchemaId<infer $Schema>
  ? ShapeData<Shape<$Schema>>
  : never

/**
 * derive a tuple of component shapes by mapping the schema of an archetype
 * type
 */
export type ArchetypeData<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends SchemaId<infer $Schema>
    ? ShapeData<Shape<$Schema>>
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
    return [] as ArchetypeColumnOf<$Schema>
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
    edgesSet: [],
    edgesUnset: [],
    entities,
    entityIndex,
    layout: [],
    length: 0,
    onArchetypeInsert: makeSignal(),
    onSet: makeSignal(),
    table,
    type: [],
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
    edgesSet: [],
    edgesUnset: [],
    entities,
    entityIndex,
    layout,
    length: 0,
    onArchetypeInsert: makeSignal(),
    onSet: makeSignal(),
    table,
    type,
  }
}

export function insertIntoArchetype<$Type extends Type>(
  world: World,
  archetype: Archetype<$Type>,
  entity: Entity,
  data: ArchetypeData<$Type>,
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
    archetype.onSet.dispatch(entity)
  }
  archetype.length++
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
          const prevArray = prevColumn[key]
          if (hit) nextColumn[key][next.length] = prevArray[prevIndex]
          prevArray[prevIndex] = prevArray[prevEnd]
          prevArray[prevEnd] = 0
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
  next.onSet.dispatch(entity)
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
          const prevArray = prevColumn[key]
          if (hit) nextColumn[key][next.length] = prevArray[prevIndex]
          prevArray[prevIndex] = 0
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
  next.onSet.dispatch(entity)
  next.entities[next.length] = entity
  next.entityIndex[entity] = next.length
  next.length++
  prev.entityIndex[entity] = -1
  prev.length--
}

export function grow(archetype: Archetype) {}
