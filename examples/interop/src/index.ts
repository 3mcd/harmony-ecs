import * as Cannon from "cannon-es"
import * as Three from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { formats, makeEntity, makeQuery, makeSchema, makeWorld } from "../../../lib/src"

const world = makeWorld(1_000)

const Vec3 = { x: formats.float64, y: formats.float64, z: formats.float64 }
const Quaternion = {
  x: formats.float64,
  y: formats.float64,
  z: formats.float64,
  w: formats.float64,
}
const Body = makeSchema(world, { position: Vec3, quaternion: Quaternion })
const Mesh = makeSchema(world, { position: Vec3, quaternion: Quaternion })
const canvas = document.getElementById("game") as HTMLCanvasElement
const renderer = new Three.WebGLRenderer({ antialias: true, canvas })
const camera = new Three.PerspectiveCamera(45, 1, 0.1, 2000000)
const controls = new OrbitControls(camera, renderer.domElement)
const scene = new Three.Scene()
const simulation = new Cannon.World({ gravity: new Cannon.Vec3(0, -9.81, 0) })

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
    new Cannon.Vec3(10, 0.1, 10),
    Cannon.Body.STATIC,
    0xffffff,
    0,
  )
}

function copyBodyToMesh(body: Cannon.Body, mesh: Three.Mesh) {
  mesh.position.x = body.position.x
  mesh.position.y = body.position.y
  mesh.position.z = body.position.z
  mesh.quaternion.x = body.quaternion.x
  mesh.quaternion.y = body.quaternion.y
  mesh.quaternion.z = body.quaternion.z
  mesh.quaternion.w = body.quaternion.w
}

function random(scale = 2) {
  return (0.5 - Math.random()) * scale
}

const bodies = makeQuery(world, [Body, Mesh] as const)

let spawnInit = true

function spawn() {
  if (spawnInit) {
    // spawn the ground
    makeEntity(world, [Body, Mesh], createGround())
    // spawn boxes at semi-random points
    for (let i = 0; i < 10; i++) {
      makeEntity(
        world,
        [Body, Mesh],
        createBox(new Cannon.Vec3(random(20), 20, random(20))),
      )
    }
    spawnInit = true
  }
}

let physicsInit = true

function physics(dt: number) {
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
  simulation.step(dt / 1000)
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
