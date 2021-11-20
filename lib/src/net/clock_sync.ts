import * as Debug from "../debug"

export type ClockSync = {
  neededSampleCount: number
  assumedOutlierRate: number
  serverSecondsOffset?: number
  samplesOrderedByRank: number[]
  sampleRankQueue: number[]
  sampleValueQueue: number[]
  maxTolerableDeviation: number
}

export type ClockSyncReady = Omit<ClockSync, "serverSecondsOffset"> & {
  serverSecondsOffset: number
}

function getTargetSortedIndex(array: number[], value: number) {
  let low = 0
  let high = array.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (array[mid]! < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function calcRollingMeanOffsetSeconds(clockSync: ClockSync) {
  let totalOffsetSum = 0
  const start = calcSamplesToDiscardPerExtreme(clockSync)
  const end = clockSync.samplesOrderedByRank.length - start
  for (let i = start; i < end; i++) {
    const sample = clockSync.samplesOrderedByRank[i]
    Debug.invariant(sample !== undefined)
    totalOffsetSum += sample
  }
  return totalOffsetSum / (end - start)
}

function isReady(clockSync: ClockSync): clockSync is ClockSyncReady {
  return clockSync.serverSecondsOffset !== undefined
}

function hasDesynced(clockSync: ClockSyncReady, rollingMeanOffsetSeconds: number) {
  return (
    Math.abs(rollingMeanOffsetSeconds - clockSync.serverSecondsOffset) >
    clockSync.maxTolerableDeviation
  )
}

function calcSamplesToDiscardPerExtreme(clockSync: ClockSync) {
  return Math.ceil(
    Math.max((clockSync.neededSampleCount * clockSync.assumedOutlierRate) / 2, 1),
  )
}

export function make(
  neededSampleCount: number,
  assumedOutlierRate: number,
  maxTolerableDeviation: number,
): ClockSync {
  return {
    neededSampleCount,
    assumedOutlierRate,
    samplesOrderedByRank: [],
    sampleRankQueue: [],
    sampleValueQueue: [],
    maxTolerableDeviation,
  }
}

export function addSample(clockSync: ClockSync, measuredSecondsOffset: number) {
  // find the target index in the sorted array of offsets
  const rank = getTargetSortedIndex(clockSync.samplesOrderedByRank, measuredSecondsOffset)
  // insert the new offset sample
  clockSync.sampleRankQueue.unshift(rank)
  clockSync.sampleValueQueue.unshift(measuredSecondsOffset)
  clockSync.samplesOrderedByRank.splice(rank, 0, measuredSecondsOffset)

  Debug.invariant(
    clockSync.samplesOrderedByRank.length <= calcSamplesToDiscardPerExtreme(clockSync),
  )

  if (clockSync.samplesOrderedByRank.length >= calcNeededSamples(clockSync)) {
    const rollingMeanOffsetSeconds = calcRollingMeanOffsetSeconds(clockSync)
    if (!isReady(clockSync) || hasDesynced(clockSync, rollingMeanOffsetSeconds)) {
      clockSync.serverSecondsOffset = rollingMeanOffsetSeconds
    }

    clockSync.sampleValueQueue.pop()
    clockSync.samplesOrderedByRank.splice(clockSync.sampleRankQueue.pop()!, 1)
  }
}

function calcNeededSamples(clockSync: ClockSync) {
  return clockSync.neededSampleCount + calcSamplesToDiscardPerExtreme(clockSync) * 2
}
