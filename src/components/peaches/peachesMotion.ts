import * as THREE from "three"
import type { PeachesMood } from "./peachesBehavior"

// WebGL motion values are shared by the welcome and corner avatar.
const motion = {
  blendSpeed: 9,
  floatHeight: 0.035,
  floatSpeed: 1.6,
  swayAngle: 0.055,
  blinkDuration: 0.18,
  blinkMinimum: 2.8,
  blinkVariation: 2.6,
  roundMouthMix: 0.22,
  roundMouthSpeed: 8,
  retrySmile: 0.35,
  thinkingTilt: 0.12,
  thinkingArmAngle: 0.2,
  gestureAngle: 0.11,
  gestureSpeed: 3.8,
  swaySpeed: 0.7,
  rollAngle: 0.025,
  rollSpeed: 0.8,
  bounceHeight: 0.16,
  bounceDuration: 0.65,
  nodAngle: 0.12,
  nodDuration: 0.9,
  raisedArmAngle: 0.95,
}

function facialGroup(model: THREE.Object3D, objectName: string, names: string[]) {
  const mesh = model.getObjectByName(objectName)
  if (!(mesh instanceof THREE.Mesh) || !mesh.morphTargetInfluences || !mesh.morphTargetDictionary) {
    return (_values: number[], _blend: number) => {}
  }
  const weights = mesh.morphTargetInfluences
  const indices = names.map((name) => mesh.morphTargetDictionary?.[name])
  return (values: number[], blend: number) => {
    // Morphs are additive. Crossfade within each group, keeping its total <= 1.
    const targets = values.map((value) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0)
    const total = Math.max(1, targets.reduce((sum, value) => sum + value, 0))
    indices.forEach((index, slot) => {
      if (index !== undefined) weights[index] += (targets[slot] / total - weights[index]) * blend
    })
  }
}

function wrapAt(model: THREE.Object3D, object: THREE.Object3D, center: THREE.Vector3) {
  const parent = object.parent
  if (!parent) return null
  model.updateMatrixWorld(true)
  const point = parent.worldToLocal(object.localToWorld(center.clone()))
  const pivot = new THREE.Group()
  pivot.position.copy(point)
  const offset = new THREE.Group()
  offset.position.copy(point).negate()
  parent.add(pivot)
  pivot.add(offset)
  // Keep the object's transform unchanged: exported animation still targets it.
  offset.add(object)
  return pivot
}

export function createPeachesMotion(model: THREE.Object3D) {
  const leftEye = facialGroup(model, "Eye_L", ["blinkLeft", "happyLeft"])
  const rightEye = facialGroup(model, "Eye_R", ["blinkRight", "happyRight"])
  const mouth = facialGroup(model, "Mouth_Neutral", ["mouthClosed", "mouthOpen", "mouthRound", "smile"])
  const body = model.getObjectByName("Body")
  const centerOf = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return new THREE.Vector3()
    object.geometry.computeBoundingBox()
    return object.geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3()
  }
  const root = body?.parent
  const bodyPivot = body && root ? wrapAt(model, root, root.worldToLocal(body.localToWorld(centerOf(body)))) : null
  const bodyRestY = bodyPivot?.position.y || 0
  const arms = ["Arm_L", "Arm_R"].map((name) => {
    const object = model.getObjectByName(name)
    return object ? { object, rotation: object.quaternion.clone() } : null
  })
  const rotation = new THREE.Quaternion()
  const axis = new THREE.Vector3(0, 0, 1)
  let lastMood: PeachesMood = "idle"
  let lastSequence = 0
  let moodStarted = 0
  let blinkStarted = -1
  let nextBlink = motion.blinkMinimum + Math.random() * motion.blinkVariation
  let joy = 0
  let thinking = 0
  let leftArm = 0
  let rightArm = 0

  const update = (elapsed: number, delta: number, mood: PeachesMood, level: number, waving: boolean, reduced: boolean, sequence = 0) => {
    if (mood !== lastMood || sequence !== lastSequence) {
      lastMood = mood
      lastSequence = sequence
      moodStarted = elapsed
    }
    const age = elapsed - moodStarted
    const blend = reduced ? 1 : 1 - Math.exp(-motion.blendSpeed * delta)
    const happy = mood === "correct" || mood === "complete"
    joy += ((happy ? 1 : 0) - joy) * blend
    thinking += ((mood === "thinking" ? 1 : 0) - thinking) * blend
    if (elapsed >= nextBlink) {
      blinkStarted = elapsed
      nextBlink = elapsed + motion.blinkMinimum + Math.random() * motion.blinkVariation
    }
    const blinkAge = elapsed - blinkStarted
    const blink = !reduced && blinkStarted >= 0 && blinkAge < motion.blinkDuration
      ? Math.sin(blinkAge / motion.blinkDuration * Math.PI) : 0
    const happyEyes = reduced ? 0 : joy * (1 - blink)
    leftEye([blink, happyEyes], 1)
    rightEye([blink, happyEyes], 1)
    const speaking = mood === "speaking" && !reduced
    const volume = Number.isFinite(level) ? THREE.MathUtils.clamp(level, 0, 1) : 0
    const round = motion.roundMouthMix * (0.5 + 0.5 * Math.sin(elapsed * motion.roundMouthSpeed))
    const smile = mood === "retry" ? Math.max(joy, motion.retrySmile) : joy
    mouth(reduced ? [0, 0, 0, 0] : speaking
      ? [1 - volume, volume * (1 - round), volume * round, 0]
      : [0, 0, 0, smile], blend)
    if (bodyPivot) {
      const bounce = happy && age < motion.bounceDuration
        ? Math.sin(age / motion.bounceDuration * Math.PI) * motion.bounceHeight : 0
      const nod = mood === "retry" && age < motion.nodDuration
        ? Math.sin(age / motion.nodDuration * Math.PI * 2) * motion.nodAngle : 0
      const targetY = reduced ? 0 : Math.sin(elapsed * motion.floatSpeed) * motion.floatHeight + bounce
      const targetX = reduced ? 0 : nod
      const targetZ = reduced ? 0 : thinking * motion.thinkingTilt + Math.sin(elapsed * motion.rollSpeed) * motion.rollAngle
      bodyPivot.position.y += (targetY + bodyRestY - bodyPivot.position.y) * blend
      bodyPivot.rotation.x += (targetX - bodyPivot.rotation.x) * blend
      bodyPivot.rotation.y += ((reduced ? 0 : Math.sin(elapsed * motion.swaySpeed) * motion.swayAngle) - bodyPivot.rotation.y) * blend
      bodyPivot.rotation.z += (targetZ - bodyPivot.rotation.z) * blend
    }
    const gesture = speaking ? Math.sin(elapsed * motion.gestureSpeed) * motion.gestureAngle * volume : 0
    leftArm += ((reduced ? 0 : joy * motion.raisedArmAngle) - leftArm) * blend
    rightArm += ((reduced ? 0 : -joy * motion.raisedArmAngle - thinking * motion.thinkingArmAngle + gesture) - rightArm) * blend
    arms.forEach((arm, index) => {
      if (!arm || (index === 0 && waving && !reduced)) return
      arm.object.quaternion.copy(arm.rotation).multiply(rotation.setFromAxisAngle(axis, index === 0 ? leftArm : rightArm))
    })
  }
  return { update }
}
