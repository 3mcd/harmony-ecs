export function remEuclid(left: number, right: number): number {
  const remainder = left % right
  return remainder < 0 ? remainder + Math.abs(right) : remainder
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function fract(value: number) {
  return value % 1
}
