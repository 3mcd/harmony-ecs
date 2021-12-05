import * as WorkerThreads from "worker_threads"
import * as F from "./lib/src/f"

let registry = F.makeRegistry(10)
let worker = new WorkerThreads.Worker("./worker.js")
let entities: F.Id[] = []

worker.postMessage({ type: "registry", registry })

for (let i = 0; i < 5; i++) {
  entities.push(await F.make(registry))
}

const createdTables: F.Table[] = []

await F.add(registry, entities[0], entities[1], 0, createdTables)
await F.add(registry, entities[1], entities[2], 0, createdTables)
await F.add(registry, entities[2], entities[3], 0, createdTables)
await F.add(registry, entities[3], entities[4], 0, createdTables)

for (let i = 0; i < createdTables.length; i++) {
  worker.postMessage({ type: "table", table: createdTables[i] })
}

await F.destroy(registry, entities[0])
await F.destroy(registry, entities[4])

worker.postMessage({ type: "log" })
