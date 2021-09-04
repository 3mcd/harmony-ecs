export type SignalSubscriber<T> = (t: T) => void
export type Signal<T> = ((subscriber: SignalSubscriber<T>) => () => void) & {
  dispatch: (t: T) => void
}

export function makeSignal<T>(): Signal<T> {
  const subscribers: SignalSubscriber<T>[] = []
  function subscribe(subscriber: SignalSubscriber<T>) {
    const index = subscribers.push(subscriber) - 1
    return function unsubscribe() {
      const head = subscribers.pop()
      if (head === subscriber) {
        return
      }
      subscribers[index] = head
    }
  }
  function dispatch(t: T) {
    for (let i = 0; i < subscribers.length; i++) {
      subscribers[i](t)
    }
  }
  return Object.assign(subscribe, {
    dispatch,
  })
}
