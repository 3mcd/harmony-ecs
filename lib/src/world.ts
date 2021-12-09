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

export function make(entityInit: number): Struct {
  let world = {
    registry: Registry.make(entityInit),
    signals: {
      onTableCreate: Signal.make(),
      onTableGrow: Signal.make(),
    },
  }

  globalThis.addEventListener("message", event => {
    let message = event.data as Message
    switch (message.type) {
      case MessageType.Registry:
        world.registry = message.registry
        break
      case MessageType.Table:
        world.registry.tableIndex[Type.hash(message.table.type)] = message.table
        break
    }
  })

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

enum MessageType {
  Registry,
  Table,
}

export type MessageRegistry = { type: MessageType.Registry; registry: Registry.Struct }
export type MessageTable = { type: MessageType.Table; table: Table.Struct }
export type Message = MessageRegistry | MessageTable
