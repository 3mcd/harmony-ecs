import * as Debug from "../debug"

type ClockSyncSampleQueue = {
  maxLength: number
  values: number[]
  indices: number[]
}

export type ClockSync = {
  maxTolerableDeviation: number
  samples: ClockSyncSampleQueue
  samplesToDiscardPerExtreme: number
  serverSecondsOffset?: number
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

function getTargetSortedIndex(sortedNumberQueue: ClockSyncSampleQueue, value: number) {
  const { values } = sortedNumberQueue
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

export function enqueue(sortedNumberQueue: ClockSyncSampleQueue, value: number) {
  const { indices, values } = sortedNumberQueue
  const index = getTargetSortedIndex(sortedNumberQueue, value)
  for (let i = values.length; i > index; i--) {
    values[i] = values[i - 1]!
  }
  for (let i = 0; i < indices.length; i++) {
    if (indices[i]! >= index) indices[i]++
  }
  values[index] = value
  if (indices.unshift(index) > sortedNumberQueue.maxLength) {
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

export type ClockSyncReady = Omit<ClockSync, "serverSecondsOffset"> & {
  serverSecondsOffset: number
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

export function isReady(clockSync: ClockSync): clockSync is ClockSyncReady {
  return clockSync.serverSecondsOffset !== undefined
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
