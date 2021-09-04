import { formats, makeBinarySchema, makeSchema } from "../../src/schema"

export const Vector3 = { x: formats.float64, y: formats.float64, z: formats.float64 }
export const Position = makeBinarySchema(Vector3)
export const PositionNative = makeSchema(Vector3)
export const Velocity = makeBinarySchema(Vector3)
export const VelocityNative = makeSchema(Vector3)
export const Body = [Position, Velocity] as const
export const BodyHybrid = [Position, VelocityNative] as const
export const BodyNative = [PositionNative, VelocityNative] as const
