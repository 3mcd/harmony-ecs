import * as Symbols from "./symbols"

export type Timestamp = number
export type Timestamped<T> = { [Symbols.$timestamp]: Timestamp }
