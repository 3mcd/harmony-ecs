class AssertionError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export function assert(predicate: boolean, message: string = ""): asserts predicate {
  if (predicate === false) {
    throw new AssertionError(message)
  }
}

export function invariant(predicate: boolean, message: string = ""): asserts predicate {
  if (predicate === false) {
    throw new AssertionError(message)
  }
}
