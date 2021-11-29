export class AssertionError extends Error {
  readonly inner?: Error
  constructor(message: string, inner?: Error) {
    super(message)
    this.inner = inner
  }
}

export function unwrap(error: unknown) {
  let final = error
  if (error instanceof AssertionError && error.inner !== undefined) {
    final = error.inner
  }
  return final
}

export function assert(
  predicate: boolean,
  message: string = "",
  inner?: Error,
): asserts predicate {
  if (predicate === false) {
    throw new AssertionError(message, inner)
  }
}

export function invariant(
  predicate: boolean,
  message: string = "",
  inner?: Error,
): asserts predicate {
  if (predicate === false) {
    throw new AssertionError(message, inner)
  }
}
