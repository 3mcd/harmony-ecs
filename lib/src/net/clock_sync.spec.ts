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
      expect(clockSync.neededSampleCount).toBe(neededSampleCount)
      expect(clockSync.assumedOutlierRate).toBe(assumedOutlierRate)
      expect(clockSync.maxTolerableDeviation).toBe(maxTolerableDeviation)
    })
  })

  describe("addSample", () => {
    it("updates the offset when sample count met", () => {
      const clockDesync = 9
      const neededSampleCount = 4
      const assumedOutlierRate = 1
      const clockSync = ClockSync.make(neededSampleCount, assumedOutlierRate, 0.2)
      const totalNeededSampleCount = ClockSync.calcNeededSamples(clockSync)
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
      const totalNeededSampleCount = ClockSync.calcNeededSamples(clockSync)
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
      const totalNeededSampleCount = ClockSync.calcNeededSamples(clockSync)
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
    it("uses the assumed outlier rate to ignore outliers", () => {})
    it("throws if the number of samples to discard is greater than the number of added samples", () => {})
    it("incorporates outlier samples when outlier count is greater than assumed outlier rate", () => {})
  })

  describe("isReady", () => {
    it("returns false if needed sample count not met", () => {})
  })
})
