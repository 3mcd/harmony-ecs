import * as Timestamp from "./timestamp"

export function makeInterestingTimestamps() {
  return [
    Timestamp.make(Timestamp.MIN),
    Timestamp.make(Timestamp.MIN / 2),
    Timestamp.make(-1),
    Timestamp.make(),
    Timestamp.make(1),
    Timestamp.make(Timestamp.MAX / 2),
    Timestamp.make(Timestamp.MAX),
  ]
}

function makeOffsets(initial: Timestamp.IntTimestamp) {
  const plusOne = Timestamp.add(initial, 1)
  const plusLimit = Timestamp.add(initial, Timestamp.MAX)
  const plusWrapped = Timestamp.add(plusLimit, 1)
  const plusWrappedLimit = Timestamp.subtract(plusLimit, Timestamp.MIN)
  const plusWrappedFull = Timestamp.add(plusWrappedLimit, 1)
  const minusOne = Timestamp.subtract(initial, 1)
  const minusLimit = Timestamp.add(initial, Timestamp.MIN)
  const minusWrapped = Timestamp.subtract(minusLimit, 1)
  const minusWrappedLimit = Timestamp.subtract(minusLimit, Timestamp.MAX)
  const minusWrappedFull = Timestamp.subtract(minusWrappedLimit, 1)
  return {
    plusOne,
    plusLimit,
    plusWrapped,
    plusWrappedLimit,
    plusWrappedFull,
    minusOne,
    minusLimit,
    minusWrapped,
    minusWrappedLimit,
    minusWrappedFull,
  }
}

describe("Timestamp", () => {
  describe("(comparison functions)", () => {
    it("account for wrapping", () => {
      function testTimestampOrderWithInitial(initial: Timestamp.IntTimestamp) {
        const offsets = makeOffsets(initial)
        expect(Timestamp.isGreaterThan(offsets.plusOne, initial)).toBe(true)
        expect(Timestamp.isGreaterThan(offsets.plusLimit, initial)).toBe(true)
        expect(Timestamp.isLessThan(offsets.plusWrapped, initial)).toBe(true)
        expect(Timestamp.isLessThan(offsets.plusWrappedLimit, initial)).toBe(true)
        expect(Timestamp.isEqual(offsets.plusWrappedFull, initial)).toBe(true)
        expect(Timestamp.isLessThan(offsets.minusOne, initial)).toBe(true)
        expect(Timestamp.isLessThan(offsets.minusLimit, initial)).toBe(true)
        expect(Timestamp.isGreaterThan(offsets.minusWrapped, initial)).toBe(true)
        expect(Timestamp.isGreaterThan(offsets.minusWrappedLimit, initial)).toBe(true)
        expect(Timestamp.isEqual(offsets.minusWrappedFull, initial)).toBe(true)
      }

      for (const timestamp of makeInterestingTimestamps()) {
        testTimestampOrderWithInitial(timestamp)
      }
    })
  })

  describe("(difference)", () => {
    it("account for wrapping", () => {
      function testTimestampDifferenceWithInitial(initial: Timestamp.IntTimestamp) {
        const offsets = makeOffsets(initial)
        expect(Timestamp.subtract(offsets.plusOne, initial)).toEqual(Timestamp.make(1))
        expect(Timestamp.subtract(offsets.plusLimit, initial)).toEqual(
          Timestamp.make(Timestamp.MAX),
        )
        expect(Timestamp.subtract(offsets.plusWrapped, initial)).toEqual(
          Timestamp.make(Timestamp.MIN),
        )
        expect(Timestamp.subtract(offsets.plusWrappedLimit, initial)).toEqual(
          Timestamp.make(-1),
        )
        expect(Timestamp.subtract(offsets.plusWrappedFull, initial)).toEqual(
          Timestamp.make(),
        )
        expect(Timestamp.subtract(offsets.minusOne, initial)).toEqual(Timestamp.make(-1))
        expect(Timestamp.subtract(offsets.minusLimit, initial)).toEqual(
          Timestamp.make(Timestamp.MIN),
        )
        expect(Timestamp.subtract(offsets.minusWrapped, initial)).toEqual(
          Timestamp.make(Timestamp.MAX),
        )
        expect(Timestamp.subtract(offsets.minusWrappedLimit, initial)).toEqual(
          Timestamp.make(1),
        )
        expect(Timestamp.subtract(offsets.minusWrappedFull, initial)).toEqual(
          Timestamp.make(),
        )
      }

      for (const timestamp of makeInterestingTimestamps()) {
        testTimestampDifferenceWithInitial(timestamp)
      }
    })
  })

  describe("increment", () => {
    it("creates a new timestamp one step ahead of the provided timestamp", () => {
      for (const timestamp of makeInterestingTimestamps()) {
        const incremented = Timestamp.increment(Timestamp.make(timestamp))
        expect(Timestamp.isGreaterThan(incremented, timestamp)).toBe(true)
        expect(Timestamp.subtract(incremented, timestamp)).toBe(Timestamp.make(1))
      }
    })
  })

  describe("fromSeconds", () => {
    it("finds the corresponding timestamp for the provided time in seconds", () => {
      expect(Timestamp.fromSeconds(0, 1)).toEqual(Timestamp.make())
      expect(Timestamp.fromSeconds(1, 1)).toEqual(Timestamp.make(1))
      expect(Timestamp.fromSeconds(0.25, 0.25)).toEqual(Timestamp.make(1))
      expect(Timestamp.fromSeconds(-1, 1)).toEqual(Timestamp.make(-1))
      expect(Timestamp.fromSeconds(Timestamp.MAX, 1)).toEqual(Timestamp.MAX)
      expect(Timestamp.fromSeconds(Timestamp.MAX + 1, 1)).toEqual(Timestamp.MIN)
      expect(Timestamp.fromSeconds(Timestamp.MIN, 1)).toEqual(Timestamp.MIN)
      expect(Timestamp.fromSeconds(Timestamp.MIN - 1, 1)).toEqual(Timestamp.MAX)
    })
  })

  describe("asSeconds", () => {
    it("calculates the time in seconds for the provided timestamp", () => {
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(0, 1), 1)).toEqual(0)
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(1, 1), 1)).toEqual(1)
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(1, 1), 0.25)).toEqual(0.25)
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(0.25, 0.25), 0.25)).toEqual(0.25)
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(-1, 1), 1)).toEqual(-1)
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(Timestamp.MAX, 1), 1)).toEqual(
        Timestamp.MAX,
      )
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(Timestamp.MAX + 1, 1), 1)).toEqual(
        Timestamp.MIN,
      )
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(Timestamp.MIN, 1), 1)).toEqual(
        Timestamp.MIN,
      )
      expect(Timestamp.asSeconds(Timestamp.fromSeconds(Timestamp.MIN - 1, 1), 1)).toEqual(
        Timestamp.MAX,
      )
    })
  })
})
