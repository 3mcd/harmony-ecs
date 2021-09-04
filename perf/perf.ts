import { performance } from "perf_hooks"

type Perf = { executor: () => void; once: boolean }
type PerfStats = { duration: number }
type PerfResults = {
  id: string
  iterations: number
  timing: { average: number; median: number; min: number; max: number }
  stats: PerfStats[]
}

export function makePerf(executor: () => void, once = false): Perf {
  return {
    executor,
    once,
  }
}

export function makePerfOnce(executor: () => void): Perf {
  return makePerf(executor, true)
}

function median<T>(arr: T[], iteratee: (element: T) => number) {
  const mid = Math.floor(arr.length / 2)
  const num = arr.map(iteratee).sort((a, b) => a - b)
  return arr.length % 2 !== 0 ? num[mid] : (num[mid - 1] + num[mid]) / 2
}

export function runPerf(perf: Perf, id: string, iterations = 100): PerfResults {
  const stats: PerfStats[] = []

  if (perf.once) {
    iterations = 1
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    perf.executor()
    stats.push({ duration: performance.now() - start })
  }

  return {
    id,
    iterations,
    timing: {
      average: stats.reduce((a, x) => a + x.duration, 0) / stats.length,
      median: median(stats, stat => stat.duration),
      min: stats.reduce((a, x) => Math.min(a, x.duration), Infinity),
      max: stats.reduce((a, x) => Math.max(a, x.duration), 0),
    },
    stats,
  }
}

function pretty(x: number) {
  return parseFloat(x.toFixed(2)).toLocaleString()
}

export function printPerfResults(results: PerfResults) {
  const { id, timing, iterations } = results
  console.log(`${id}
 iterations ${iterations}
 timing ${
   iterations > 1
     ? `
  mean   ${pretty(timing.average)}ms
  median ${pretty(timing.median)}ms
  min    ${pretty(timing.min)}ms
  max    ${pretty(timing.max)}ms
 `
     : `${pretty(timing.average)}ms`
 }`)
}
