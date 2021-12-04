import * as WorkerThreads from "worker_threads"
import * as F from "./lib/src/f"
import * as Signal from "./lib/src/signal"

let registry = F.makeRegistry(10)
let worker = new WorkerThreads.Worker("./worker.js")
let entities: F.Id[] = []
let signals = {
  onTableAdd: Signal.make<F.Table>(),
}

Signal.subscribe(signals.onTableAdd, table =>
  worker.postMessage({ type: "table", table }),
)

worker.postMessage({ type: "registry", registry })

for (let i = 0; i < 5; i++) {
  entities.push(await F.make(registry))
}

await F.add(registry, entities[0], entities[1], undefined, signals)
await F.add(registry, entities[1], entities[2], undefined, signals)
await F.add(registry, entities[2], entities[3], undefined, signals)
await F.add(registry, entities[3], entities[4], undefined, signals)

worker.postMessage({ type: "log" })
