import * as Entity from "./entity"
import * as Registry from "./registry"
import * as Signal from "./signal"
import * as Table from "./table"
import * as Type from "./type"

type Signals = Registry.Signals

export type Struct = {
  registry: Registry.Struct
  signals: Signals
}

enum MessageType {
  Registry,
  Table,
}

type MessageHeader<T extends MessageType> = { type: T; worldId: number }

export type MessageRegistry = MessageHeader<MessageType.Registry> & {
  registry: Registry.Struct
}
export type MessageTable = MessageHeader<MessageType.Table> & {
  table: Table.Struct
}
export type Message = MessageRegistry | MessageTable

let worldHead = 0
let worlds: Struct[] = []

export function make(entityInit: number, id = worldHead++): Struct {
  let world = {
    id,
    registry: Registry.make(entityInit),
    signals: {
      onTableCreate: Signal.make(),
      onTableGrow: Signal.make(),
      onRegistryGrow: Signal.make(),
    },
  }

  worlds[id] = world

  return world
}

export function makeEntity(world: Struct) {
  return Registry.makeEntity(world.registry)
}

export function add<T extends Type.Struct>(
  world: Struct,
  entity: Entity.Id,
  type: T,
  init: Table.Row<T>,
) {
  return Registry.add(world.registry, entity, type, init, world.signals)
}

export function onMessage(event: MessageEvent) {
  let message = event.data as Message
  if (!("worldId" in message)) return
  let world = worlds[message.worldId]
  switch (message.type) {
    case MessageType.Registry:
      world.registry = message.registry
      break
    case MessageType.Table:
      world.registry.tableIndex[Type.hash(message.table.type)] = message.table
      break
  }
}

globalThis.addEventListener("message", onMessage)
