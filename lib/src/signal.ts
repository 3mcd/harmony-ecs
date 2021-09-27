import { invariant } from "./debug"

export type SignalSubscriber<T> = (t: T) => void
export type Signal<T = void> = { subscribers: SignalSubscriber<T>[] }

export function makeSignal<T>(): Signal<T> {
  const subscribers: SignalSubscriber<T>[] = []
  return { subscribers }
}

export function subscribe<T>(signal: Signal<T>, subscriber: SignalSubscriber<T>) {
  const index = signal.subscribers.push(subscriber) - 1
  return function unsubscribe() {
    signal.subscribers.splice(index, 1)
  }
}

export function dispatch<T>(signal: Signal<T>, t: T) {
  for (let i = signal.subscribers.length - 1; i >= 0; i--) {
    const subscriber = signal.subscribers[i]
    invariant(subscriber !== undefined)
    subscriber(t!)
  }
}
