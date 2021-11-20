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

  describe("addSample", () => {})
})
