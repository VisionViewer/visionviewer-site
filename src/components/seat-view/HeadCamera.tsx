import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3 } from '../../lib/view'

const { degToRad, radToDeg, clamp, damp } = THREE.MathUtils

/** Amplitude de rotation de la tête autour de la direction de l'écran */
const YAW_LIMIT = degToRad(75)
const PITCH_LIMIT = degToRad(40)
/** Le regard ne monte ni ne descend jamais au-delà de cet angle par rapport à l'horizontale */
const PITCH_ABSOLUTE = degToRad(55)
const INTRO_DURATION = 2.6
/** Durée du glissement d'un siège à un autre */
const HOP_DURATION = 0.75

interface HeadCameraProps {
  /** Identifiant du siège (pour le débogage) */
  seatId: string
  /** Position des yeux du spectateur */
  eye: Vec3
  /** Point regardé par défaut : le centre de l'écran */
  target: Vec3
  /** Point de départ du survol d'introduction */
  overview: Vec3
  /** La scène est chargée : le survol peut démarrer */
  ready: boolean
  /** Sans animation : la caméra est placée directement au siège */
  skipIntro: boolean
  /** Avancement du survol (0 → 1), partagé avec l'éclairage */
  intro: RefObject<number>
  /** Incrémenté pour recentrer le regard sur l'écran */
  recenterSignal: number
  onArrive: () => void
  onLook: () => void
}

/**
 * Caméra « tête de spectateur » : fixée à la position des yeux du siège, elle
 * regarde le centre de l'écran. L'utilisateur peut tourner la tête (glisser,
 * flèches du clavier) dans un angle limité, sans jamais se déplacer.
 *
 * À l'ouverture, elle arrive par un survol de la salle ; quand `eye` change
 * ensuite, elle glisse d'un siège à l'autre.
 */
export default function HeadCamera({
  seatId,
  eye,
  target,
  overview,
  ready,
  skipIntro,
  intro,
  recenterSignal,
  onArrive,
  onLook,
}: HeadCameraProps) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera

  const pose = useMemo(() => {
    const eyeV = new THREE.Vector3(...eye)
    const targetV = new THREE.Vector3(...target)
    const dir = targetV.clone().sub(eyeV).normalize()
    return {
      eye: eyeV,
      target: targetV,
      start: new THREE.Vector3(...overview),
      // Arrivée par l'arrière et le dessus, sans traverser les rangées voisines
      control: eyeV.clone().add(new THREE.Vector3(0, 2.4, 3.4)),
      // Pendant le survol, on regarde d'abord le siège, puis l'écran
      seatFocus: eyeV.clone().add(new THREE.Vector3(0, -0.45, 0)),
      /** Tangage de base (regard vers le centre de l'écran), pour borner la rotation de la tête */
      pitch: Math.asin(dir.y),
    }
  }, [eye, target, overview])

  const look = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 })
  const phase = useRef<'waiting' | 'intro' | 'seated'>('waiting')
  const progress = useRef(0)
  const hop = useRef<{ from: THREE.Vector3; t: number } | null>(null)
  const seatedAt = useRef<THREE.Vector3 | null>(null)
  const scratch = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])

  const callbacks = useRef({ onArrive, onLook })
  callbacks.current = { onArrive, onLook }

  // Ouverture de la vue : on part du survol
  useEffect(() => {
    phase.current = 'waiting'
    progress.current = 0
    hop.current = null
    seatedAt.current = null
    intro.current = skipIntro ? 1 : 0
  }, [intro, skipIntro])

  // Changement de siège une fois assis : on glisse jusqu'au nouveau, regard recentré
  useEffect(() => {
    if (phase.current !== 'seated' || !seatedAt.current) return
    if (seatedAt.current.equals(pose.eye)) return
    hop.current = { from: camera.position.clone(), t: 0 }
    seatedAt.current = pose.eye
    look.current.targetYaw = 0
    look.current.targetPitch = 0
  }, [pose, camera])

  useEffect(() => {
    look.current.targetYaw = 0
    look.current.targetPitch = 0
  }, [recenterSignal])

  // Rotation de la tête : glisser (doigt ou souris), flèches, double-clic pour recentrer
  useEffect(() => {
    const el = gl.domElement
    let pointer: number | null = null
    let lastX = 0
    let lastY = 0

    const turn = (dYaw: number, dPitch: number) => {
      const l = look.current
      l.targetYaw = clamp(l.targetYaw + dYaw, -YAW_LIMIT, YAW_LIMIT)
      l.targetPitch = clamp(
        l.targetPitch + dPitch,
        Math.max(-PITCH_LIMIT, -PITCH_ABSOLUTE - pose.pitch),
        Math.min(PITCH_LIMIT, PITCH_ABSOLUTE - pose.pitch),
      )
      callbacks.current.onLook()
    }

    const onDown = (e: PointerEvent) => {
      if (phase.current !== 'seated' || pointer !== null) return
      pointer = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return
      // La scène suit le doigt : 1 px = la part d'angle de vue qu'il représente
      const radPerPx = degToRad(camera.fov) / el.clientHeight
      turn((e.clientX - lastX) * radPerPx, (e.clientY - lastY) * radPerPx)
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return
      pointer = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = 'grab'
    }
    const onDoubleClick = () => {
      look.current.targetYaw = 0
      look.current.targetPitch = 0
    }
    const onKey = (e: KeyboardEvent) => {
      if (phase.current !== 'seated') return
      const step = degToRad(8)
      if (e.key === 'ArrowLeft') turn(step, 0)
      else if (e.key === 'ArrowRight') turn(-step, 0)
      else if (e.key === 'ArrowUp') turn(0, step)
      else if (e.key === 'ArrowDown') turn(0, -step)
      else return
      e.preventDefault()
    }

    el.style.cursor = 'grab'
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('dblclick', onDoubleClick)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('dblclick', onDoubleClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl, camera, pose])

  useFrame((state, delta) => {
    // Champ de vision adapté au format : large en paysage, étiré en portrait
    const fov = fovForAspect(state.size.width / state.size.height)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    const dt = Math.min(delta, 1 / 30)

    if (phase.current === 'waiting') {
      if (skipIntro) {
        phase.current = 'seated'
        seatedAt.current = pose.eye
        intro.current = 1
        callbacks.current.onArrive()
      } else {
        camera.position.copy(pose.start)
        camera.lookAt(pose.seatFocus)
        if (ready) phase.current = 'intro'
        return
      }
    }

    if (phase.current === 'intro') {
      progress.current = Math.min(1, progress.current + dt / INTRO_DURATION)
      const t = progress.current
      intro.current = t

      // Trajectoire : courbe de Bézier du point de survol jusqu'aux yeux
      const e = easeInOutCubic(t)
      scratch.a.lerpVectors(pose.start, pose.control, e)
      scratch.b.lerpVectors(pose.control, pose.eye, e)
      camera.position.lerpVectors(scratch.a, scratch.b, e)

      // Regard : du siège vers le centre de l'écran sur la fin du trajet
      const gaze = easeInOutCubic(clamp((t - 0.3) / 0.7, 0, 1))
      scratch.a.lerpVectors(pose.seatFocus, pose.target, gaze)
      camera.lookAt(scratch.a)

      if (t >= 1) {
        phase.current = 'seated'
        seatedAt.current = pose.eye
        callbacks.current.onArrive()
      }
      return
    }

    // Assis : position fixe, ou glissement vers le nouveau siège
    if (hop.current) {
      hop.current.t = Math.min(1, hop.current.t + dt / (skipIntro ? 0.001 : HOP_DURATION))
      const e = easeInOutCubic(hop.current.t)
      camera.position.lerpVectors(hop.current.from, pose.eye, e)
      camera.position.y += Math.sin(Math.PI * e) * 0.12 // on se lève légèrement pour changer de place
      if (hop.current.t >= 1) hop.current = null
    } else {
      camera.position.copy(pose.eye)
    }

    // Orientation (ordre YXZ : lacet puis tangage, jamais de roulis) :
    // direction du centre de l'écran depuis la position courante + rotation de la tête
    const l = look.current
    l.yaw = damp(l.yaw, l.targetYaw, 14, dt)
    l.pitch = damp(l.pitch, l.targetPitch, 14, dt)
    scratch.a.copy(pose.target).sub(camera.position).normalize()
    const baseYaw = Math.atan2(-scratch.a.x, -scratch.a.z)
    const basePitch = Math.asin(scratch.a.y)
    camera.rotation.set(basePitch + l.pitch, baseYaw + l.yaw, 0, 'YXZ')

    if (import.meta.env.DEV) {
      // Aide à la vérification : état de la caméra lisible depuis la console
      ;(window as unknown as Record<string, unknown>).__visionViewer = {
        seatId,
        phase: phase.current,
        hopping: hop.current !== null,
        position: camera.position.toArray().map((v) => +v.toFixed(3)),
        yawDeg: +radToDeg(baseYaw + l.yaw).toFixed(2),
        pitchDeg: +radToDeg(basePitch + l.pitch).toFixed(2),
        fov: +camera.fov.toFixed(1),
      }
    }
  })

  return null
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Champ de vision vertical (degrés) visant ~70° à l'horizontale, borné pour
 * limiter la déformation sur les écrans très hauts (mobile en portrait).
 */
function fovForAspect(aspect: number): number {
  const horizontal = degToRad(70)
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect)
  return clamp(radToDeg(vertical), 50, 84)
}
