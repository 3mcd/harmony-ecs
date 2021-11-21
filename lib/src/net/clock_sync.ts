import * as Debug from "../debug"

/**
 * `ClockSyncSampleQueue` is a FIFO buffer of server offset samples,
 * continuously sorted by magnitude. It is comprised of sorted array of clock
 * offset samples (numbers), and an associated indices array that catalogues
 * the order in which each sample was enqueued. The enqueue algorithm is O(n),
 * optimizing for memory over speed, in that zero intermidate objects are
 * created when enqueuing new values.
 */
type ClockSyncSampleQueue = {
  maxLength: number
  values: number[]
  indices: number[]
}

/**
 * `ClockSync` maintains a queue of offset samples, continuously calculating an
 * average offset while new samples are enqueued.
 */
export type ClockSync = {
  maxTolerableDeviation: number
  samples: ClockSyncSampleQueue
  samplesToDiscardPerExtreme: number
  serverSecondsOffset?: number
}

export type ClockSyncReady = Omit<ClockSync, "serverSecondsOffset"> & {
  serverSecondsOffset: number
}

function makeSampleQueue(maxLength: number): ClockSyncSampleQueue {
  const values: number[] = []
  const indices: number[] = []
  return {
    maxLength,
    values,
    indices,
  }
}

function getTargetSortedIndex(samples: ClockSyncSampleQueue, value: number) {
  const { values } = samples
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (values[mid]! < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function enqueue(samples: ClockSyncSampleQueue, value: number) {
  const { indices, values } = samples
  const index = getTargetSortedIndex(samples, value)
  for (let i = values.length; i > index; i--) {
    values[i] = values[i - 1]!
  }
  for (let i = 0; i < indices.length; i++) {
    if (indices[i]! >= index) indices[i]++
  }
  values[index] = value
  if (indices.unshift(index) > samples.maxLength) {
    const index = indices.pop()!
    for (let i = 0; i < indices.length; i++) {
      if (indices[i]! >= index) indices[i]--
    }
    const end = values.length - 1
    for (let i = index; i < end; i++) {
      values[i] = values[i + 1]!
    }
    values.pop()
  }
}

function calcRollingMeanOffsetSeconds(clockSync: ClockSync) {
  const { samplesToDiscardPerExtreme, samples: sampleQueue } = clockSync
  const end = clockSync.samples.values.length - samplesToDiscardPerExtreme
  let totalOffsetSum = 0
  for (let i = samplesToDiscardPerExtreme; i < end; i++) {
    const sample = sampleQueue.values[i]
    Debug.invariant(sample !== undefined)
    totalOffsetSum += sample
  }
  return totalOffsetSum / (end - samplesToDiscardPerExtreme)
}

function hasDesynced(clockSync: ClockSyncReady, rollingMeanOffsetSeconds: number) {
  return (
    Math.abs(rollingMeanOffsetSeconds - clockSync.serverSecondsOffset) >
    clockSync.maxTolerableDeviation
  )
}

function calcSamplesToDiscardPerExtreme(
  neededSampleCount: number,
  assumedOutlierRate: number,
) {
  return Math.ceil(Math.max((neededSampleCount * assumedOutlierRate) / 2, 1))
}

export function isReady(clockSync: ClockSync): clockSync is ClockSyncReady {
  return clockSync.serverSecondsOffset !== undefined
}

export function addSample(clockSync: ClockSync, measuredSecondsOffset: number) {
  // insert the offset sample
  enqueue(clockSync.samples, measuredSecondsOffset)
  // update server offset by taking the average of the samples ignoring outliers
  if (clockSync.samples.values.length === clockSync.samples.maxLength) {
    const rollingMeanOffsetSeconds = calcRollingMeanOffsetSeconds(clockSync)
    if (!isReady(clockSync) || hasDesynced(clockSync, rollingMeanOffsetSeconds)) {
      clockSync.serverSecondsOffset = rollingMeanOffsetSeconds
    }
  }
}

export function make(
  neededSampleCount: number,
  assumedOutlierRate: number,
  maxTolerableDeviation: number,
): ClockSync {
  Debug.assert(neededSampleCount > 0)
  Debug.assert(assumedOutlierRate >= 0)
  const samplesToDiscardPerExtreme = calcSamplesToDiscardPerExtreme(
    neededSampleCount,
    assumedOutlierRate,
  )
  return {
    samples: makeSampleQueue(neededSampleCount + samplesToDiscardPerExtreme),
    maxTolerableDeviation,
    samplesToDiscardPerExtreme,
  }
}
