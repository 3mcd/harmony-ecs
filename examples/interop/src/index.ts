import * as Cannon from "cannon-es"
import * as Three from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import {
  formats,
  makeEntity,
  makeQuery,
  makeSchema,
  makeWorld,
  set,
} from "../../../lib/src"

const BOUNCE_IMPULSE = new Cannon.Vec3(0, 10, 0)

const Vec3 = { x: formats.float64, y: formats.float64, z: formats.float64 }
const Quaternion = {
  x: formats.float64,
  y: formats.float64,
  z: formats.float64,
  w: formats.float64,
}
const Object3D = { position: Vec3, quaternion: Quaternion }
const world = makeWorld(1_000)
const Body = makeSchema(world, Object3D)
const Mesh = makeSchema(world, Object3D)
const Bounce = makeSchema(world, { latestBounceTime: formats.float64 })
const canvas = document.getElementById("game") as HTMLCanvasElement
const renderer = new Three.WebGLRenderer({ antialias: true, canvas })
const camera = new Three.PerspectiveCamera(45, 1, 0.1, 2000000)
const controls = new OrbitControls(camera, renderer.domElement)
const scene = new Three.Scene()
const simulation = new Cannon.World({ gravity: new Cannon.Vec3(0, -9.81, 0) })
const bodies = makeQuery(world, [Body, Mesh] as const)
const bouncing = makeQuery(world, [Body, Bounce] as const)

scene.add(new Three.AmbientLight(0x404040), new Three.DirectionalLight(0xffffff, 0.5))

function scale() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener("resize", scale, false)
scale()

function createBox(
  position = new Cannon.Vec3(0, 0, 0),
  halfExtents = new Cannon.Vec3(0.5, 0.5, 0.5),
  type: Cannon.BodyType = Cannon.Body.DYNAMIC,
  color = 0xff0000,
  mass = 1,
) {
  const shape = new Cannon.Box(halfExtents)
  const body = new Cannon.Body({ mass, type, position, shape })
  const geometry = new Three.BoxGeometry(
    halfExtents.x * 2,
    halfExtents.y * 2,
    halfExtents.z * 2,
  )
  const material = new Three.MeshLambertMaterial({ color })
  const mesh = new Three.Mesh(geometry, material)
  return [body, mesh]
}

function createGround() {
  return createBox(
    new Cannon.Vec3(0, 0, 0),
    new Cannon.Vec3(25, 0.1, 25),
    Cannon.Body.STATIC,
    0xffffff,
    0,
  )
}

function copyBodyToMesh(body: Cannon.Body, mesh: Three.Mesh) {
  const { x, y, z } = body.interpolatedPosition
  const { x: qx, y: qy, z: qz, w: qw } = body.interpolatedQuaternion
  mesh.position.x = x
  mesh.position.y = y
  mesh.position.z = z
  mesh.quaternion.x = qx
  mesh.quaternion.y = qy
  mesh.quaternion.z = qz
  mesh.quaternion.w = qw
}

function random(scale = 2) {
  return (0.5 - Math.random()) * scale
}

let spawnInit = true

function spawn() {
  if (spawnInit) {
    // spawn ground
    makeEntity(world, [Body, Mesh], createGround())
    // spawn boxes
    for (let i = 0; i < 100; i++) {
      const entity = makeEntity(
        world,
        [Body, Mesh],
        createBox(new Cannon.Vec3(random(25), 20, random(25))),
      )
      if (i % 2 === 0) set(world, entity, Bounce, { latestBounceTime: 0 })
    }
    spawnInit = false
  }
}

let physicsInit = true

function physics(dt: number) {
  const now = performance.now()
  if (physicsInit) {
    for (let i = 0; i < bodies.length; i++) {
      const [entities, [b]] = bodies[i]
      for (let j = 0; j < entities.length; j++) {
        simulation.addBody(
          // manually cast the component to it's true type since we lose type
          // information by storing it in the ECS
          b[j] as Cannon.Body,
        )
      }
    }
    physicsInit = false
  }
  for (let i = 0; i < bouncing.length; i++) {
    const [entities, [by, bo]] = bouncing[i]
    for (let j = 0; j < entities.length; j++) {
      const bounce = bo[j]
      const body = by[j] as Cannon.Body
      if (now - bounce.latestBounceTime >= 2000) {
        bounce.latestBounceTime = now
        body.applyLocalImpulse(BOUNCE_IMPULSE)
      }
    }
  }
  simulation.step(1 / 60, dt / 1000, 5)
}

let renderInit = true

function render() {
  // add camera to scene
  if (renderInit) {
    scene.add(camera)
    camera.position.x = 50
    camera.position.y = 50
    camera.position.z = 50
    for (let i = 0; i < bodies.length; i++) {
      const [entities, [, m]] = bodies[i]
      for (let j = 0; j < entities.length; j++) {
        scene.add(m[j] as Three.Mesh)
      }
    }
    renderInit = false
  }
  for (let i = 0; i < bodies.length; i++) {
    const [entities, [b, m]] = bodies[i]
    for (let j = 0; j < entities.length; j++) {
      copyBodyToMesh(b[j] as Cannon.Body, m[j] as Three.Mesh)
    }
  }
  // render scene
  controls.update()
  renderer.render(scene, camera)
}

let prev = 0

function step(now: number) {
  spawn()
  physics(now - (prev || now))
  render()
  requestAnimationFrame(step)
  prev = now
}

requestAnimationFrame(step)
