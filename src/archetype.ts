import { Entity } from "./entity"
import {
  AnySchema,
  BinarySchema,
  Format,
  getSchemaId,
  isBinarySchema,
  isFormat,
  NativeSchema,
  ShapeOf,
} from "./schema"
import { InstanceOf } from "./types"

export type Type = ReadonlyArray<AnySchema>

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

type AnyArchetypeColumn =
  | BinaryColumnOf<ShapeOf<BinarySchema>>
  | NativeColumnOf<ShapeOf<NativeSchema>>

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
  [K in keyof $Type]: $Type[K] extends AnySchema ? ArchetypeColumnOf<$Type[K]> : never
}

/**
 * a collection of entities which share components of the same type
 */
export type Archetype<$Type extends Type = Type> = {
  entities: Entity[]
  entityIndex: number[]
  type: $Type
  table: ArchetypeTable<$Type>
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

/**
 * derive a tuple of component shapes by mapping the schema of an archetype
 * type
 */
export type ArchetypeDataOf<$Type extends Type> = {
  [K in keyof $Type]: $Type[K] extends BinarySchema
    ? BinaryDataOf<ShapeOf<$Type[K]>>
    : $Type[K] extends NativeSchema
    ? NativeDataOf<ShapeOf<$Type[K]>>
    : never
}

function makeArchetypeColumn<$Schema extends AnySchema>(
  schema: $Schema,
  size: number,
): ArchetypeColumnOf<$Schema> {
  if (isBinarySchema(schema)) {
    if (isFormat(schema.shape)) {
      // binary & simple
      const buffer = new SharedArrayBuffer(size * schema.shape.binary.BYTES_PER_ELEMENT)
      return new schema.shape.binary(buffer) as ArchetypeColumnOf<$Schema>
    } else {
      // binary & complex
      // map each member node to a typed array
      return Object.entries(schema.shape).reduce((a, [memberName, memberNode]) => {
        const buffer = new SharedArrayBuffer(size * memberNode.binary.BYTES_PER_ELEMENT)
        a[memberName] = new memberNode.binary(buffer)
        return a
      }, {}) as ArchetypeColumnOf<$Schema>
    }
  } else {
    // native
    return [] as ArchetypeColumnOf<$Schema>
  }
}

function makeArchetypeTable<$Type extends Type>(
  type: $Type,
  size: number,
): ArchetypeTable<$Type> {
  // TODO(3mcd): unsure how to get TypeScript to agree with this without
  // casting to unknown
  return type.map(schema =>
    makeArchetypeColumn(schema, size),
  ) as unknown as ArchetypeTable<$Type>
}

export function makeArchetype<$Type extends Type>(
  type: $Type,
  size: number,
): Archetype<$Type> {
  assertTypeNormalized(type)
  const entities: Entity[] = []
  const entityIndex: number[] = []
  const table = makeArchetypeTable(type, size)
  return { entities, entityIndex, type, table }
}

export function insertIntoArchetype<$Type extends Type>(
  archetype: Archetype<$Type>,
  entity: Entity,
  data: ArchetypeDataOf<$Type>,
) {
  const length = archetype.entities.length
  for (let i = 0; i < archetype.type.length; i++) {
    const schema = archetype.type[i]
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
  }
}

export function removeFromArchetype<$Type extends Type>(
  archetype: Archetype<$Type>,
  entity: number,
) {
  const length = archetype.entities.length
  const index = archetype.entityIndex[entity]
  const head = archetype.entities.pop()

  delete archetype.entityIndex[entity]

  // TODO(3mcd): can this logic be easily consolidated?
  if (index === length - 1) {
    // entity was head
    for (let i = 0; i < archetype.type.length; i++) {
      const schema = archetype.type[i]
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
    const moved = length - 1
    for (let i = 0; i < archetype.type.length; i++) {
      const schema = archetype.type[i]
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
      }
    }
    archetype.entities[index] = head
    archetype.entityIndex[head] = index
  }
}

export function grow(archetype: Archetype) {}

export function normalizeType(type: Type) {
  return Object.freeze(type.slice().sort((a, b) => getSchemaId(a) - getSchemaId(b)))
}

export function assertTypeNormalized(type: Type) {
  for (let i = 0; i < type.length - 1; i++) {
    if (getSchemaId(type[i]) > getSchemaId(type[i + 1])) {
      throw new TypeError("type not normalized")
    }
  }
}

export function typeContains(type: Type, subset: Type) {
  let i = 0
  let j = 0
  if (type.length < subset.length) {
    return false
  }
  while (i < type.length && j < subset.length) {
    const typeSchemaId = getSchemaId(type[i])
    const subsetSchemaId = getSchemaId(subset[i])
    if (typeSchemaId < subsetSchemaId) {
      i++
    } else if (typeSchemaId === subsetSchemaId) {
      i++
      j++
    } else {
      return false
    }
  }
  return j === subset.length
}
