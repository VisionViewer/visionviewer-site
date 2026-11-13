import type { RoomLayout, Slot } from './room'

export type Vec3 = readonly [number, number, number]

/** Hauteur des yeux d'une personne assise, au-dessus du sol de sa rangée (m) */
export const EYE_HEIGHT = 1.15

/** Position des yeux du spectateur assis à ce siège. */
export function eyePosition(slot: Slot): Vec3 {
  const [x, y, z] = slot.position
  return [x, y + EYE_HEIGHT, z]
}

/** Centre de l'écran : c'est le point que la caméra regarde par défaut. */
export function screenCenter(layout: RoomLayout): Vec3 {
  return [0, layout.screen.centerY, 0]
}

export interface ViewMetrics {
  /** Distance des yeux au centre de l'écran (m) */
  distance: number
  /** Angle horizontal sous lequel on voit toute la largeur de l'écran (degrés) */
  horizontalAngle: number
}

export function viewMetrics(layout: RoomLayout, slot: Slot): ViewMetrics {
  const [ex, ey, ez] = eyePosition(slot)
  const [, cy] = screenCenter(layout)
  const half = layout.screen.width / 2
  // Angle entre les directions du bord gauche et du bord droit de l'écran, vu de dessus
  const angle = Math.atan2(half - ex, ez) + Math.atan2(half + ex, ez)
  return {
    distance: Math.hypot(ex, ey - cy, ez),
    horizontalAngle: (angle * 180) / Math.PI,
  }
}

/**
 * Point de départ du survol d'introduction : derrière et au-dessus de la salle,
 * légèrement décalé du côté du siège choisi.
 */
export function overviewPosition(layout: RoomLayout, slot: Slot): Vec3 {
  const { depth, height } = layout.shell
  return [slot.position[0] * 0.35, height + depth * 0.3, depth * 1.22]
}
