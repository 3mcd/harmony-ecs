import * as Debug from "./debug"

export type Subscriber<T> = (t: T) => void
export type Struct<T = void> = Subscriber<T>[]

export function make<T>(): Struct<T> {
  return []
}

export function subscribe<T>(subscribers: Struct<T>, subscriber: Subscriber<T>) {
  const index = subscribers.push(subscriber) - 1
  return function unsubscribe() {
    subscribers.splice(index, 1)
  }
}

export function dispatch<T>(subscribers: Struct<T>, t: T) {
  for (let i = subscribers.length - 1; i >= 0; i--) {
    const subscriber = subscribers[i]
    Debug.invariant(subscriber !== undefined)
    subscriber(t!)
  }
}
