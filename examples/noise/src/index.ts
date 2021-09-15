import {
  formats,
  makeBinarySchema,
  makeEntity,
  makeQuery,
  makeWorld,
  not,
  set,
} from "../../../lib/src"

const SIZE = 500
const COUNT = SIZE * SIZE
const canvas = document.getElementById("game") as HTMLCanvasElement
const world = makeWorld(COUNT)
const context = canvas.getContext("2d")
const image = context.getImageData(0, 0, SIZE, SIZE)
const buf = new ArrayBuffer(image.data.length)
const buf8 = new Uint8ClampedArray(buf)
const buf32 = new Uint32Array(buf)

const Position = makeBinarySchema(world, { x: formats.uint32, y: formats.uint32 })
const Fixed = makeBinarySchema(world, formats.uint32)
const Point = [Position] as const
const PointFixed = [...Point, Fixed] as const

for (let i = 0; i < SIZE; i++) {
  for (let j = 0; j < SIZE; j++) {
    makeEntity(world, Point, [{ x: i, y: j }])
  }
}

const noise = makeQuery(world, Point, not([Fixed]))
const fixed = makeQuery(world, PointFixed)
const rand: number[] = []

let randomHead = 1e6 + 90_000
while (randomHead--) rand.push(Math.round(Math.random()))

function step() {
  for (let i = 0; i < noise.length; i++) {
    const [e, [p]] = noise[i]
    for (let j = 0; j < e.length; j++) {
      const x = p.x[j]
      const y = p.y[j]
      const random =
        (++randomHead >= rand.length ? rand[(randomHead = 0)] : rand[randomHead]) * 50
      buf32[y * SIZE + x] = (255 << 24) | (random << 16) | (random << 8) | random
    }
  }
  for (let i = 0; i < fixed.length; i++) {
    const [e, [p, f]] = fixed[i]
    for (let j = 0; j < e.length; j++) {
      const x = p.x[j]
      const y = p.y[j]
      buf32[y * SIZE + x] = f[j]
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
    const [e, [p]] = noise[i]
    for (let j = 0; j < e.length; j++) {
      const _x = p.x[j]
      const _y = p.y[j]
      if (_x === x && _y === y) {
        const _n = e[j - SIZE]
        const _e = e[j + 1]
        const _s = e[j + SIZE]
        const _w = e[j - 1]
        const color = buf32[y * SIZE + x] | (100 << 16) | (50 << 8)
        set(world, e[j], Fixed, color)
        set(world, _n, Fixed, color)
        set(world, _e, Fixed, color)
        set(world, _s, Fixed, color)
        set(world, _w, Fixed, color)
        break
      }
    }
  }
})

step()