import * as THREE from "three"
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js"
import { clone } from "three/addons/utils/SkeletonUtils.js"

type PeachesAssets = { neutral: GLTF; animated: GLTF | null }
let assets: Promise<PeachesAssets> | undefined

// The cache owns shared geometry/materials for the page's lifetime.
export function preloadPeachesModels() {
  if (!assets) {
    const loader = new GLTFLoader()
    assets = Promise.allSettled([
      loader.loadAsync("/models/peaches-neutral-expressions.glb"),
      loader.loadAsync("/models/peaches-hover-wave-expressions.glb"),
    ]).then(([neutral, animated]) => {
      if (neutral.status !== "fulfilled") {
        assets = undefined
        throw neutral.reason
      }
      return { neutral: neutral.value, animated: animated.status === "fulfilled" ? animated.value : null }
    })
  }
  return assets
}

const peach = new THREE.MeshStandardMaterial({ color: 0xffb3a7, roughness: 0.7, metalness: 0 })
// Peaches' orange fur replaces the robot's dark shell.
const orange = 0xd4480a
// Peaches' chest emblem: a cat face outline and smile, in emblem units (1 = emblem width).
const emblemOutline = [
  [-0.36, 0.48], [-0.16, 0.29], [0, 0.27], [0.16, 0.29], [0.36, 0.48], [0.45, 0.12], [0.42, -0.14],
  [0.29, -0.31], [0, -0.38], [-0.29, -0.31], [-0.42, -0.14], [-0.45, 0.12],
]
const emblemSmile = [[-0.16, -0.02], [-0.11, -0.14], [0, -0.19], [0.11, -0.14], [0.16, -0.02]]

// Adds the cat ears, nose, tail and chest emblem to the supplied robot model.
// Parts join the model's root so they float, sway and bounce with the body.
function addCatFeatures(model: THREE.Object3D) {
  const body = model.getObjectByName("Body")
  const face = model.getObjectByName("Face_Inset")
  const mouth = model.getObjectByName("Mouth_Neutral")
  const root = body?.parent
  if (!(body instanceof THREE.Mesh) || !(face instanceof THREE.Mesh) || !(mouth instanceof THREE.Mesh) || !root) return
  model.updateMatrixWorld(true)
  for (const name of ["Chest_Mark_1", "Chest_Mark_2"]) {
    const mark = model.getObjectByName(name)
    if (mark) mark.visible = false
  }
  const shell = body.material as THREE.MeshStandardMaterial
  const fur = shell.clone()
  fur.color.setHex(orange)
  model.traverse((part) => {
    if (part instanceof THREE.Mesh && part.material === shell) part.material = fur
  })
  const white = face.material as THREE.Material
  const cat = new THREE.Group()
  cat.name = "Cat_Features"
  root.add(cat)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const ray = new THREE.Raycaster()
  // Projects a front-view point onto a surface so flat details hug the rounded body.
  const onSurface = (surface: THREE.Mesh, x: number, y: number, lift: number) => {
    ray.set(new THREE.Vector3(x, y, 5).applyMatrix4(model.matrixWorld), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(surface, false)[0]
    const point = hit ? hit.point.clone().addScaledVector(new THREE.Vector3(0, 0, 1), lift) : new THREE.Vector3(x, y, 0.5)
    return point.applyMatrix4(toRoot)
  }
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.5)
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 12, radius, 10, closed), material)
    if (!closed) {
      for (const end of [curve.getPoint(0), curve.getPoint(1)]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material)
        cap.position.copy(end)
        mesh.add(cap)
      }
    }
    cat.add(mesh)
    return mesh
  }

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.48, 32), fur)
    ear.scale.z = 0.5
    ear.position.set(side * 0.42, 2.18, -0.02)
    ear.rotation.z = -side * 0.32
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 32), peach)
    inner.scale.z = 0.4
    inner.position.set(0, -0.06, 0.13)
    ear.add(inner)
    cat.add(ear)
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), peach)
  nose.scale.set(0.075, 0.05, 0.035)
  nose.position.copy(onSurface(face, 0, 1.49, 0.01))
  cat.add(nose)

  const emblemWidth = 0.44
  const emblem = (points: number[][]) => points.map(([x, y]) => onSurface(body, x * emblemWidth, 0.85 + y * emblemWidth, 0.014))
  tube(emblem(emblemOutline), 0.017, white, true)
  tube(emblem(emblemSmile), 0.017, white)

  const tail = [[0.3, 0.52, -0.32], [0.7, 0.4, -0.36], [1.0, 0.44, -0.3], [1.13, 0.57, -0.24], [1.12, 0.72, -0.18]]
  tube(tail.map(([x, y, z]) => new THREE.Vector3(x, y, z)), 0.065, fur)
}

// Shared by the live avatar and its matching still render.
export function createPeachesScene(loaded: PeachesAssets) {
  const scene = new THREE.Scene()
  const carrier = new THREE.Group()
  scene.add(carrier)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9af71, 3))
  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(-3, 5, 7)
  scene.add(light)
  const rim = new THREE.DirectionalLight(0xffe655, 3)
  rim.position.set(4, 2, -3)
  scene.add(rim)
  const rest = clone(loaded.neutral.scene)
  const bounds = new THREE.Box3().setFromObject(rest)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  carrier.scale.setScalar(2.6 / Math.max(size.x, size.y, size.z))
  // Measure before adding the ears so Peaches keeps the original framing.
  addCatFeatures(rest)
  rest.position.copy(center).negate()
  carrier.add(rest)
  let mixer: THREE.AnimationMixer | undefined
  let action: THREE.AnimationAction | undefined
  if (loaded.animated?.animations.length) {
    // Both supplied exports share the same geometry and named object hierarchy.
    mixer = new THREE.AnimationMixer(rest)
    action = mixer.clipAction(loaded.animated.animations[0])
  }
  const fit = (width: number, height: number) => {
    camera.aspect = width / height
    camera.position.set(0, 0, 6.4 / Math.min(camera.aspect, 1))
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }
  fit(1, 1)
  return { scene, carrier, camera, rest, mixer, action, fit }
}
