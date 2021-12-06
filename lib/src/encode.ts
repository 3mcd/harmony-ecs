import * as Format from "./format"
import * as Query from "./query"
import * as Symbols from "./symbols"
import * as Schema from "./schema"
import * as Type from "./type"
import * as World from "./world"
import * as Debug from "./debug"
import * as Entity from "./entity"
import * as Archetype from "./archetype"

type Part = {
  data: number[]
  view: Format.Struct[]
  byteLength: number
}

function push(part: Part, data: number, format: Format.Struct) {
  const dataLength = part.data.push(data)
  const viewLength = part.view.push(format)
  Debug.invariant(dataLength === viewLength)
  part.byteLength += format.binary.BYTES_PER_ELEMENT
  return dataLength - 1
}

function write(
  part: Part,
  handle: number,
  data: number,
  format: Format.Struct = part.view[handle]!,
) {
  part.byteLength +=
    format.binary.BYTES_PER_ELEMENT - part.view[handle]!.binary.BYTES_PER_ELEMENT
  part.data[handle] = data
  part.view[handle] = format
}

function reset(part: Part) {
  while (part.data.pop()) {}
  while (part.view.pop()) {}
  part.byteLength = 0
}

function encodeRow<$Type extends Type.Struct>(
  part: Part,
  index: number,
  schemas: Schema.AnySchema[],
  recordData: Query.RecordData<$Type>,
) {
  for (let j = 0; j < schemas.length; j++) {
    const schema = schemas[j]
    Debug.invariant(schema !== undefined)
    const data = recordData[j]
    Debug.invariant(data !== undefined)
    switch (schema.kind) {
      case Schema.SchemaKind.BinaryScalar:
      case Schema.SchemaKind.NativeScalar:
        const value = (data as Archetype.ColumnOfSchema<typeof schema>["data"])[index]
        Debug.invariant(typeof value === "number")
        push(part, value, schema.shape)
        break
      case Schema.SchemaKind.BinaryStruct: {
        for (const prop in schema.shape) {
          const format = schema.shape[prop]
          Debug.invariant(format !== undefined)
          const field = (data as Archetype.ColumnOfSchema<typeof schema>["data"])[prop]
          Debug.invariant(field !== undefined)
          const value = field[index]
          Debug.invariant(typeof value === "number")
          push(part, value, format)
        }
        break
      }
      case Schema.SchemaKind.NativeObject: {
        const component = (data as Archetype.ColumnOfSchema<typeof schema>["data"])[index]
        Debug.invariant(component !== undefined)
        for (const prop in schema.shape) {
          const value = component[prop]
          Debug.invariant(typeof value === "number")
          const format = schema.shape[prop]
          Debug.invariant(format !== undefined)
          push(part, value, format)
        }
        break
      }
    }
  }
}

export function encodeQuery<$Type extends Type.Struct>(
  world: World.Struct,
  query: Query.Struct<$Type>,
  part: Part,
  filter?: (entity: Entity.Id) => boolean,
) {
  const type = query[Symbols.$type]
  const schemas = type.map(schemaId => World.findSchemaById(world, schemaId))
  for (let i = 0; i < type.length; i++) {
    const schemaId = type[i]
    Debug.invariant(schemaId !== undefined)
    push(part, schemaId, Format.uint32)
  }
  let size = 0
  let sizeHandle = push(part, size, Format.uint32)
  if (filter === undefined) {
    for (const [entities, recordData] of query) {
      size += entities.length
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        Debug.invariant(entity !== undefined)
        push(part, entity, Format.uint32)
        encodeRow(part, i, schemas, recordData)
      }
    }
  } else {
    for (const [entities, recordData] of query) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        Debug.invariant(entity !== undefined)
        if (filter(entity) === false) continue
        size++
        push(part, entity, Format.uint32)
        encodeRow(part, i, schemas, recordData)
      }
    }
  }
  write(part, sizeHandle, size)
}

export function serialize(
  part: Part,
  view: DataView = new DataView(new ArrayBuffer(part.byteLength)),
  offset = 0,
) {
  Debug.assert(
    offset + part.byteLength > view.byteLength,
    "Failed to serialize part",
    new RangeError("Part will not fit in target ArrayBuffer"),
  )
  for (let i = 0; i < part.data.length; i++) {
    const value = part.data[i]
    const format = part.view[i]
    Debug.invariant(value !== undefined)
    Debug.invariant(format !== undefined)
    switch (format.kind) {
      case Format.Kind.Uint8:
        view.setUint8(offset, value)
        break
      case Format.Kind.Uint16:
        view.setUint16(offset, value)
        break
      case Format.Kind.Uint32:
        view.setUint32(offset, value)
        break
      case Format.Kind.Int8:
        view.setInt8(offset, value)
        break
      case Format.Kind.Int16:
        view.setInt16(offset, value)
        break
      case Format.Kind.Int32:
        view.setInt32(offset, value)
        break
      case Format.Kind.Float32:
        view.setFloat32(offset, value)
        break
      case Format.Kind.Float64:
        view.setFloat64(offset, value)
        break
    }
    offset += format.binary.BYTES_PER_ELEMENT
  }
  return view.buffer
}

export function deserializeQuery(world: World.Struct, view: DataView, offset = 0) {}
