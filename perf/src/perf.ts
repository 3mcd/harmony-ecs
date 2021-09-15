const performance = globalThis.performance

type Perf = { run: () => void; once: boolean }
type PerfStats = { duration: number }
type PerfResults = {
  id: string
  iterations: number
  timing: { average: number; median: number; min: number; max: number }
  stats: PerfStats[]
}

export function makePerf(run: () => void, once = false): Perf {
  return {
    run,
    once,
  }
}

export function makePerfOnce(run: () => void): Perf {
  return makePerf(run, true)
}

function median<T>(arr: T[], iteratee: (element: T) => number) {
  const mid = Math.floor(arr.length / 2)
  const num = arr.map(iteratee).sort((a, b) => a - b)
  return arr.length % 2 !== 0 ? num[mid]! : (num[mid - 1]! + num[mid]!) / 2
}

export function runPerf(perf: Perf, id: string, iterations = 100): PerfResults {
  const stats: PerfStats[] = []

  if (perf.once) {
    iterations = 1
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    perf.run()
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

function prettyMs(x: number) {
  return `${parseFloat(x.toFixed(2)).toLocaleString()} ms`
}

function mapObject<$Object extends { [key: string]: unknown }, $Value>(
  object: $Object,
  iteratee: (value: $Object[keyof $Object], key: string) => $Value,
): { [K in keyof $Object]: $Value } {
  return Object.entries(object).reduce((a, [key, value]) => {
    a[key as keyof $Object] = iteratee(value as $Object[keyof $Object], key)
    return a
  }, {} as { [K in keyof $Object]: $Value })
}

export function printPerfResults(results: PerfResults) {
  const { id, timing, iterations } = results
  console.log(id)
  console.log(`iterations ${iterations}`)
  console.table(mapObject(timing, prettyMs))
}
