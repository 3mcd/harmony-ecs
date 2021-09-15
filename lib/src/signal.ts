import { invariant } from "./debug"

export type SignalSubscriber<T> = (t: T) => void
export type Signal<T> = ((subscriber: SignalSubscriber<T>) => () => void) & {
  dispatch: (t: T) => void
}

export function makeSignal<T>(): Signal<T> {
  const subscribers: SignalSubscriber<T>[] = []
  function subscribe(subscriber: SignalSubscriber<T>) {
    const index = subscribers.push(subscriber) - 1
    return function unsubscribe() {
      subscribers.splice(index, 1)
    }
  }
  function dispatch(t: T) {
    for (let i = subscribers.length - 1; i >= 0; i--) {
      const subscriber = subscribers[i]
      invariant(subscriber !== undefined)
      subscriber(t)
    }
  }
  return Object.assign(subscribe, {
    dispatch,
  })
}
