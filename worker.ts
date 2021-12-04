import * as F from "./lib/src/f"
import WorkerThreads from "worker_threads"

let registry: any

WorkerThreads.parentPort!.on("message", data => {
  switch (data.type) {
    case "registry":
      registry = data.registry
      break
    case "table":
      registry.tableIndex[F.makeTypeHash(data.table.type)] = data.table
      break
    case "log":
      console.log(registry)
      break
  }
})
