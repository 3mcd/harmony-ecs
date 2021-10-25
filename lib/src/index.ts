export type { Data } from "./archetype"
export * as Cache from "./cache"
export * as Schema from "./model"
export * as Query from "./query"
export * as Signal from "./signal"
export * as World from "./world"

export { formats } from "./model"

import * as EntityModule from "./entity"

const { deleteEntity, ...EntityModuleWithoutDelete } = EntityModule
export const Entity = { delete: deleteEntity, ...EntityModuleWithoutDelete }
