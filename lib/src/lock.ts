;(function () {
  let helperCode = `
  onmessage = function (ev) {
    try {
        switch (ev.data[0]) {
        case 'wait': {
      let [_, ia, index, value, timeout] = ev.data;
      let result = Atomics.wait(ia, index, value, timeout)
      postMessage(['ok', result]);
      break;
        }
        default:
      throw new Error("Bogus message sent to wait helper: " + e);
        }
    } catch (e) {
        console.log("Exception in wait helper");
        postMessage(['error', 'Exception']);
    }
  }
  `

  let helpers: any[] = []

  function allocHelper() {
    if (helpers.length > 0) return helpers.pop()
    let h = new Worker("data:application/javascript," + encodeURIComponent(helperCode))
    return h
  }

  function freeHelper(h: any) {
    helpers.push(h)
  }

  // @ts-expect-error
  if (typeof Atomics.waitAsync === "function") return

  // @ts-expect-error
  Atomics.waitAsync = function (
    ia: Int32Array,
    index_: number,
    value_: number,
    timeout_: number,
  ) {
    if (
      typeof ia != "object" ||
      !(ia instanceof Int32Array) ||
      !(ia.buffer instanceof SharedArrayBuffer)
    )
      throw new TypeError("Expected shared memory")

    // These conversions only approximate the desired semantics but are
    // close enough for the polyfill.

    let index = index_ | 0
    let value = value_ | 0
    let timeout = timeout_ === undefined ? Infinity : +timeout_

    // Range checking for the index.

    ia[index]

    // Optimization, avoid the helper thread in this common case.

    if (Atomics.load(ia, index) != value) return Promise.resolve("not-equal")

    // General case, we must wait.

    return new Promise(function (resolve, reject) {
      let h = allocHelper()
      h.onmessage = function (ev: any) {
        freeHelper(h)
        switch (ev.data[0]) {
          case "ok":
            resolve(ev.data[1])
            break
          case "error":
            reject(ev.data[1])
            break
        }
      }

      h.postMessage(["wait", ia, index, value, timeout])
    })
  }
})()

import * as Debug from "./debug"

export type Struct = {
  array: Int32Array
  index: number
}

export type StructSerialized = [sab: SharedArrayBuffer, loc: number]

const IS_WORKER =
  // @ts-expect-error
  typeof globalThis.WorkerGlobalScope !== "undefined" &&
  // @ts-expect-error
  self instanceof globalThis.WorkerGlobalScope
const NUMBYTES = 4
const ALIGN = 4

export function make(sab: SharedArrayBuffer, loc = 0) {
  return {
    array: new Int32Array(sab),
    index: loc >>> 2,
  }
}

export function initialize(sab: SharedArrayBuffer, loc: number) {
  Debug.assert(sab instanceof SharedArrayBuffer)
  Debug.assert((loc | 0) === loc)
  Debug.assert(loc >= 0)
  Debug.assert(loc % ALIGN === 0)
  Debug.assert(loc + NUMBYTES <= sab.byteLength)
  Atomics.store(new Int32Array(sab, loc, 1), 0, 0)
  return loc
}

export function _lock(lock: Struct, index = lock.index) {
  let { array } = lock
  lock.index = index
  let c: number
  if ((c = Atomics.compareExchange(array, index, 0, 1)) !== 0) {
    do {
      if (c === 2 || Atomics.compareExchange(array, index, 1, 2) !== 0)
        Atomics.wait(array, index, 2)
    } while ((c = Atomics.compareExchange(array, index, 0, 2)) !== 0)
  }
}

export const lock = _lock

export async function lockAsync(lock: Struct, index = lock.index) {
  let { array } = lock
  lock.index = index
  let c
  if ((c = Atomics.compareExchange(array, index, 0, 1)) !== 0) {
    do {
      if (c === 2 || Atomics.compareExchange(array, index, 1, 2) !== 0)
        // @ts-expect-error
        await Atomics.waitAsync(array, index, 100)
    } while ((c = Atomics.compareExchange(array, index, 0, 2)) !== 0)
  }
}

export async function lockThreadAware(lock: Struct, index = lock.index) {
  return IS_WORKER ? _lock(lock, index) : lockAsync(lock, index)
}

export function tryLock(lock: Struct, index = lock.index) {
  lock.index = index
  return Atomics.compareExchange(lock.array, index, 0, 1) === 0
}

export function unlock({ array, index }: Struct) {
  let v0 = Atomics.sub(array, index, 1)
  if (v0 !== 1) {
    Atomics.store(array, index, 0)
    Atomics.notify(array, index, 1)
  }
}

export function serialize({ array, index }: Struct) {
  return [array.buffer, index * 4]
}

export function deserialize([sab, loc]: StructSerialized) {
  return make(sab, loc)
}
