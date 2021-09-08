// // TODO(3mcd): add cli args for filtering

// import { printPerfResults, runPerf } from "./perf"
// import { suite } from "./suite"

// for (const [name, module] of Object.entries(suite)) {
//   console.log(name)
//   console.log(Array(name.length).fill("-").join(""))
//   for (const [id, executor] of Object.entries(module)) {
//     printPerfResults(runPerf(executor, id))
//   }
// }

import {
  formats,
  make,
  makeBinarySchema,
  makeStaticQuery,
  makeWorld,
  unset,
} from "../../lib/dist"

const run = count => {
  const world = makeWorld(count)
  const A = makeBinarySchema(world, formats.float64)
  const B = makeBinarySchema(world, formats.float64)
  const qa = makeStaticQuery(world, [A])
  const qb = makeStaticQuery(world, [B])
  const init = [B]

  for (let i = 0; i < count; i++) {
    make(world, [A], [i])
  }

  return () => {
    for (let i = 0; i < qa.length; i++) {
      const [e, [a]] = qa[i]
      for (let j = 0; j < e.length; j++) {
        const data = [a[j]]
        make(world, init, data)
        make(world, init, data)
      }
    }
    for (let i = 0; i < qb.length; i++) {
      const [e] = qb[i]
      for (let j = e.length - 1; j >= 0; j--) {
        unset(world, e[j], B)
      }
    }
    return world
  }
}

const world = run(1000)()

console.log(world)
