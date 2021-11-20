import { Timestamped } from "./timestamp"

export type Command<T> = Timestamped<{ type: number; data: T }>
