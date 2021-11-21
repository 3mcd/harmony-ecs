import * as ClockSync from "./clock_sync"

describe("ClockSync", () => {
  describe("make", () => {
    it("creates a ClockSync with a needed sample count, assumed outlier rate, and max tolerable clock deviation ", () => {
      const neededSampleCount = 8
      const assumedOutlierRate = 0.2
      const maxTolerableDeviation = 0.1
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      expect(clockSync.maxTolerableDeviation).toBe(maxTolerableDeviation)
    })
  })

  describe("addSample", () => {
    it("updates the offset when sample count met", () => {
      const clockDesync = 9
      const neededSampleCount = 4
      const assumedOutlierRate = 1
      const clockSync = ClockSync.make(neededSampleCount, assumedOutlierRate, 0.2)
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, clockDesync)
      }
      expect(clockSync.serverSecondsOffset).toBe(clockDesync)
    })
    it("does not update the offset when offset remains less than configured max tolerable deviation", () => {
      const initialClockDesync = 0.5
      const neededSampleCount = 5
      const assumedOutlierRate = 0.25
      const maxTolerableDeviation = 0.2
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(
          clockSync,
          clockSync.serverSecondsOffset! + maxTolerableDeviation,
        )
      }
      expect(clockSync.serverSecondsOffset).toBe(initialClockDesync)
    })
    it("updates the offset when offset is greater than the configured max tolerable deviation", () => {
      const initialClockDesync = 0.5
      const neededSampleCount = 5
      const assumedOutlierRate = 0.25
      const maxTolerableDeviation = 0.2
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync + maxTolerableDeviation * 10)
      }
      expect(clockSync.serverSecondsOffset).toBe(
        initialClockDesync + maxTolerableDeviation * 10,
      )
    })
    it("uses the assumed outlier rate to ignore outliers", () => {
      const initialClockDesync = 1
      const neededSampleCount = 10
      const assumedOutlierRate = 1
      const maxTolerableDeviation = 0.01
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      for (let i = 0; i < assumedOutlierRate * 2; i++) {
        ClockSync.addSample(
          clockSync,
          initialClockDesync + maxTolerableDeviation + Number.EPSILON,
        )
      }
      expect(clockSync.serverSecondsOffset).toBe(initialClockDesync)
    })
    it("incorporates outlier samples when outlier count is greater than assumed outlier rate", () => {
      const initialClockDesync = 1
      const neededSampleCount = 10
      const assumedOutlierRate = 1
      const maxTolerableDeviation = 0.01
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      for (let i = 0; i < assumedOutlierRate * 2 * neededSampleCount; i++) {
        ClockSync.addSample(
          clockSync,
          initialClockDesync + (maxTolerableDeviation + Number.EPSILON),
        )
      }
      expect(clockSync.serverSecondsOffset).toBeGreaterThan(initialClockDesync)
    })
  })

  describe("isReady", () => {
    it("returns false if needed sample count not met", () => {
      const initialClockDesync = 0
      const neededSampleCount = 7
      const assumedOutlierRate = 1
      const maxTolerableDeviation = 0.01
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount - 1; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      expect(ClockSync.isReady(clockSync)).toBe(false)
    })
    it("returns true if needed sample count met", () => {
      const initialClockDesync = 0
      const neededSampleCount = 7
      const assumedOutlierRate = 1
      const maxTolerableDeviation = 0.01
      const clockSync = ClockSync.make(
        neededSampleCount,
        assumedOutlierRate,
        maxTolerableDeviation,
      )
      const totalNeededSampleCount = clockSync.samples.maxLength
      for (let i = 0; i < totalNeededSampleCount; i++) {
        ClockSync.addSample(clockSync, initialClockDesync)
      }
      expect(ClockSync.isReady(clockSync)).toBe(true)
    })
  })
})
