import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Géométries volontairement simples, fusionnées en un seul maillage par objet
 * pour être dessinées en un seul appel via InstancedMesh.
 *
 * Origine locale : au sol, à l'aplomb des yeux du spectateur. Le fauteuil
 * regarde vers -z (l'écran) ; le dossier est donc du côté +z.
 */

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part))
  const merged = mergeGeometries(flat, false)
  if (!merged) throw new Error('Fusion des géométries impossible')
  for (const g of new Set([...parts, ...flat])) g.dispose()
  return merged
}

/**
 * Fauteuil : dossier arrondi, assise, piètement et deux flancs/accoudoirs (~350 triangles).
 * `span = 2` donne une place double : une banquette de deux largeurs, sans accoudoir central.
 */
export function createSeatGeometry(seatWidth: number, span: 1 | 2 = 1): THREE.BufferGeometry {
  const total = seatWidth * span
  const width = Math.max(0.36, total - 0.1)

  const back = new RoundedBoxGeometry(width, 0.64, 0.13, 2, 0.055)
  back.rotateX(0.16) // légèrement incliné vers l'arrière
  back.translate(0, 0.76, 0.27)

  const cushion = new THREE.BoxGeometry(width, 0.12, 0.46)
  cushion.translate(0, 0.44, -0.06)

  const base = new THREE.BoxGeometry(width * (span === 2 ? 0.8 : 0.6), 0.38, 0.3)
  base.translate(0, 0.19, 0.02)

  const armX = total / 2 - 0.035
  const arms = [-armX, armX].map((x) => {
    const arm = new THREE.BoxGeometry(0.06, 0.56, 0.44)
    arm.translate(x, 0.36, -0.02)
    return arm
  })

  return merge([back, cushion, base, ...arms])
}

/** Silhouette d'un spectateur assis : tête + buste (pour visualiser la gêne). */
export function createSpectatorGeometry(): THREE.BufferGeometry {
  const head = new THREE.SphereGeometry(0.105, 14, 10)
  head.translate(0, 1.17, 0.02)

  const torso = new RoundedBoxGeometry(0.44, 0.5, 0.24, 2, 0.1)
  torso.translate(0, 0.8, 0.06)

  return merge([head, torso])
}

/** Texture de lattes verticales (panneaux acoustiques) pour les murs. */
export function createSlatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 4
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, '#3a3a3a')
  gradient.addColorStop(0.08, '#b9b9b9')
  gradient.addColorStop(0.5, '#ffffff')
  gradient.addColorStop(0.92, '#b9b9b9')
  gradient.addColorStop(1, '#3a3a3a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Pseudo-aléa déterministe (0..1) à partir d'un identifiant, pour de légères variations. */
export function hash01(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}
