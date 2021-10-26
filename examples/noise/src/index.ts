import { Format, Schema, Entity, Query, World } from "../../../lib/src"

const SIZE = 500
const COUNT = SIZE * SIZE
const canvas = document.getElementById("game") as HTMLCanvasElement
const world = World.make(COUNT)
const context = canvas.getContext("2d")!
const image = context.getImageData(0, 0, SIZE, SIZE)
const buf = new ArrayBuffer(image.data.length)
const buf8 = new Uint8ClampedArray(buf)
const buf32 = new Uint32Array(buf)

const Position = Schema.makeBinary(world, { x: Format.uint32, y: Format.uint32 })
const Fixed = Schema.makeBinary(world, Format.uint32)
const Point = [Position] as const
const PointFixed = [...Point, Fixed] as const

for (let i = 0; i < SIZE; i++) {
  for (let j = 0; j < SIZE; j++) {
    Entity.make(world, Point, [{ x: i, y: j }])
  }
}

const noise = Query.make(world, Point, Query.not([Fixed]))
const fixed = Query.make(world, PointFixed)
const rand: number[] = []

let randomHead = 1e6 + 90_000
while (randomHead--) rand.push(Math.round(Math.random()))

function step() {
  for (let i = 0; i < noise.length; i++) {
    const [e, [p]] = noise[i]!
    for (let j = 0; j < e.length; j++) {
      const x = p.x[j]!
      const y = p.y[j]!
      const random =
        (++randomHead >= rand.length ? rand[(randomHead = 0)]! : rand[randomHead]!) * 50
      buf32[y * SIZE + x] = (255 << 24) | (random << 16) | (random << 8) | random
    }
  }
  for (let i = 0; i < fixed.length; i++) {
    const [e, [p, f]] = fixed[i]!
    for (let j = 0; j < e.length; j++) {
      const x = p.x[j]!
      const y = p.y[j]!
      buf32[y * SIZE + x] = f[j]!
    }
  }
  image.data.set(buf8)
  context.putImageData(image, 0, 0)
  requestAnimationFrame(step)
}

let rect = canvas.getBoundingClientRect()
let sx = 0
let sy = 0

function resize() {
  rect = canvas.getBoundingClientRect()
  sx = canvas.width / rect.width
  sy = canvas.height / rect.height
}
resize()

window.addEventListener("resize", resize)

canvas.addEventListener("mousemove", event => {
  const x = Math.round((event.clientX - rect.left) * sx)
  const y = Math.round((event.clientY - rect.top) * sy)
  for (let i = 0; i < noise.length; i++) {
    const [e, [p]] = noise[i]!
    for (let j = 0; j < e.length; j++) {
      if (p.x[j] === x && p.y[j] === y) {
        Entity.set(
          world,
          e[j]!,
          [Fixed],
          [buf32[y * SIZE + x]! | (100 << 16) | (50 << 8)],
        )
        break
      }
    }
  }
})

step()
