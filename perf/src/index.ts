// TODO(3mcd): add cli args for filtering

import { printPerfResults, runPerf } from "./perf"
import { suite } from "./suite"

for (const [name, module] of Object.entries(suite)) {
  console.log(name)
  console.log(Array(name.length).fill("-").join(""))
  for (const [id, executor] of Object.entries(module)) {
    printPerfResults(runPerf(executor, id))
  }
}
