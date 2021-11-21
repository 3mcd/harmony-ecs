import { remEuclid } from "../math"
import * as Types from "../types"
import * as Symbols from "../symbols"

export type IntTimestamp = Types.Opaque<number, "Timestamp">
export type FloatTimestamp = Types.Opaque<number, "FloatTimestamp">
export type Timestamp = IntTimestamp | FloatTimestamp
export type Timestamped<$Type = unknown> = $Type & { [Symbols.$timestamp]: IntTimestamp }

export const MIN = -32768
export const MAX = 32767

const i16 = new Int16Array(1)

export function make(value = 0) {
  i16[0] = value
  return i16[0] as IntTimestamp
}

export function fromSeconds(seconds: number, timestampSeconds: number): IntTimestamp {
  return make(makeFromSecondsFloat(seconds, timestampSeconds) as unknown as IntTimestamp)
}

export function acceptableTimestampRange(
  baseline: IntTimestamp,
  timestamp: IntTimestamp,
) {
  const maxDistanceFromMidpoint = MAX / 2
  const min = make(baseline - maxDistanceFromMidpoint)
  const max = make(baseline + maxDistanceFromMidpoint)
  return compare(timestamp, min) >= 0 || compare(timestamp, max) < 0
}

export function increment(timestamp: IntTimestamp): IntTimestamp {
  return make(timestamp + 1)
}

export function asSeconds(timestamp: Timestamp, timestampSeconds: number): number {
  return timestamp * timestampSeconds
}

export function add(timestamp: IntTimestamp, right: IntTimestamp | number): IntTimestamp {
  return make(timestamp + right)
}

export function subtract(
  timestamp: IntTimestamp,
  right: IntTimestamp | number,
): IntTimestamp {
  return make(timestamp - right)
}

export function compare(left: IntTimestamp, right: IntTimestamp): number {
  const difference = subtract(left, right)
  if (difference < 0) {
    return -1
  }
  if (difference === 0) {
    return 0
  }
  return 1
}

export function isEqual(left: IntTimestamp, right: IntTimestamp) {
  return compare(left, right) === 0
}

export function isGreaterThan(left: IntTimestamp, right: IntTimestamp) {
  return compare(left, right) === 1
}

export function isGreaterThanOrEqualTo(left: IntTimestamp, right: IntTimestamp) {
  return compare(left, right) >= 0
}

export function isLessThan(left: IntTimestamp, right: IntTimestamp) {
  return compare(left, right) === -1
}

export function isLessThanOrEqualTo(left: IntTimestamp, right: IntTimestamp) {
  return compare(left, right) <= 0
}

export function toFloat(timestamp: IntTimestamp) {
  return +timestamp as FloatTimestamp
}

export function makeFromUnwrappedFloat(frames: number) {
  return (remEuclid(frames + Math.pow(2, 15), Math.pow(2, 16)) -
    Math.pow(2, 15)) as FloatTimestamp
}

export function makeFromSecondsFloat(seconds: number, timestampSeconds: number) {
  return makeFromUnwrappedFloat(seconds / timestampSeconds)
}

export function ceil(timestamp: FloatTimestamp) {
  return make(Math.ceil(timestamp)) as IntTimestamp
}

export function floor(timestamp: FloatTimestamp) {
  return make(Math.floor(timestamp)) as IntTimestamp
}

export function subFloat(timestamp: Timestamp, right: Timestamp) {
  return makeFromUnwrappedFloat(timestamp - right)
}

export function set<$Type>(
  timestamped: $Type | Timestamped<$Type>,
  timestamp: IntTimestamp,
) {
  ;(timestamped as Timestamped)[Symbols.$timestamp] = timestamp
  return timestamped as Timestamped<$Type>
}

export function get(timestamped: Timestamped) {
  return timestamped[Symbols.$timestamp]
}
