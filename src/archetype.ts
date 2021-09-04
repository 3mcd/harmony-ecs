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

export type Signature = ReadonlyArray<AnySchema>

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
export type ArchetypeTable<$Signature extends Signature> = {
  [K in keyof $Signature]: $Signature[K] extends AnySchema
    ? ArchetypeColumnOf<$Signature[K]>
    : never
}

/**
 * a collection of entities which share components of the same type
 */
export type Archetype<$Signature extends Signature = Signature> = {
  entities: Entity[]
  entityIndex: number[]
  signature: $Signature
  table: ArchetypeTable<$Signature>
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
 * signature
 */
export type ArchetypeDataOf<$Signature extends Signature> = {
  [K in keyof $Signature]: $Signature[K] extends BinarySchema
    ? BinaryDataOf<ShapeOf<$Signature[K]>>
    : $Signature[K] extends NativeSchema
    ? NativeDataOf<ShapeOf<$Signature[K]>>
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

function makeArchetypeTable<$Signature extends Signature>(
  signature: $Signature,
  size: number,
): ArchetypeTable<$Signature> {
  // TODO(3mcd): unsure how to get TypeScript to agree with this without
  // casting to unknown
  return signature.map(schema =>
    makeArchetypeColumn(schema, size),
  ) as unknown as ArchetypeTable<$Signature>
}

export function makeArchetype<$Signature extends Signature>(
  signature: $Signature,
  size: number,
): Archetype<$Signature> {
  assertSignatureNormalized(signature)
  const entities: Entity[] = []
  const entityIndex: number[] = []
  const table = makeArchetypeTable(signature, size)
  return { entities, entityIndex, signature, table }
}

export function insertIntoArchetype<$Signature extends Signature>(
  archetype: Archetype<$Signature>,
  entity: Entity,
  data: ArchetypeDataOf<$Signature>,
) {
  const length = archetype.entities.length
  for (let i = 0; i < archetype.signature.length; i++) {
    const schema = archetype.signature[i]
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

export function removeFromArchetype<$Signature extends Signature>(
  archetype: Archetype<$Signature>,
  entity: number,
) {
  const length = archetype.entities.length
  const index = archetype.entityIndex[entity]
  const head = archetype.entities.pop()

  delete archetype.entityIndex[entity]

  // TODO(3mcd): can this logic be easily consolidated?
  if (index === length - 1) {
    // entity was head
    for (let i = 0; i < archetype.signature.length; i++) {
      const schema = archetype.signature[i]
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
    for (let i = 0; i < archetype.signature.length; i++) {
      const schema = archetype.signature[i]
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

export function normalizeSignature(signature: Signature) {
  return Object.freeze(signature.slice().sort((a, b) => getSchemaId(a) - getSchemaId(b)))
}

export function assertSignatureNormalized(signature: Signature) {
  for (let i = 0; i < signature.length - 1; i++) {
    if (getSchemaId(signature[i]) > getSchemaId(signature[i + 1])) {
      throw new TypeError("signature not normalized")
    }
  }
}

export function signatureIsSupersetOf(signature: Signature, subset: Signature) {
  let i = 0
  let j = 0
  if (signature.length < subset.length) {
    return false
  }
  while (i < signature.length && j < subset.length) {
    const signatureSchemaId = getSchemaId(signature[i])
    const subsetSchemaId = getSchemaId(subset[i])
    if (signatureSchemaId < subsetSchemaId) {
      i++
    } else if (signatureSchemaId === subsetSchemaId) {
      i++
      j++
    } else {
      return false
    }
  }
  return j === subset.length
}
