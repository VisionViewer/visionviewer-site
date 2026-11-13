/*
 * Les salles que montre la page de présentation : ce sont celles de la démo
 * (src/data/rooms/*.json), mises en forme pour la scène 3D, la coupe et les chiffres
 * cités dans la page. Page et démo décrivent donc toujours les mêmes salles.
 */
import { layouts } from '../data/rooms'
import { isSelectable, type RoomLayout, type Slot } from '../lib/room'
import { EYE_HEIGHT, viewMetrics } from '../lib/view'

export interface HallSeat {
  id: string
  /** 0 = rangée la plus proche de l'écran */
  row: number
  /** Numéro de position dans la rangée ; la première pour une place double */
  number: number
  span: 1 | 2
  pmr: boolean
  busy: boolean
  /** Centre du siège en mètres : x > 0 à droite du spectateur, y = sol de la rangée, z depuis l'écran */
  x: number
  y: number
  z: number
}

export interface Hall {
  name: string
  description: string
  /** Places à vendre (une place double compte pour deux, les emplacements PMR à part) */
  places: number
  rows: string[]
  /** Fauteuils et emplacements PMR */
  seats: HallSeat[]
  /** Les trois fauteuils d'où la page regarde l'écran : le présélectionné, puis les deux extrêmes */
  selected: string
  front: string
  back: string
  pmrCount: number
  doubleCount: number
  /** Nombre de rangs qui comptent des places doubles */
  doubleRows: number
  /** Dimensions en mètres */
  dim: {
    screenW: number
    screenH: number
    screenBottom: number
    firstRow: number
    rowGap: number
    seatW: number
    step: number
    eye: number
  }
  /** Volume de la salle, celui de la vue 3D de la démo */
  box: { halfWidth: number; height: number; depth: number }
  /** Depuis le fauteuil présélectionné : distance au centre de l'écran (m) et angle de vision (°) */
  distance: number
  angle: number
  /** Pente du gradin (°) */
  slope: number
}

function toHall(layout: RoomLayout): Hall {
  const { config } = layout
  const d = config.dimensions
  const slots = layout.rows.flatMap((row) => row.slots).filter((slot) => slot.kind !== 'empty')

  // La scène s'assoit dans des fauteuils simples et libres
  const free = (candidates: Slot[]) => candidates.filter((s) => s.span === 1 && isSelectable(s))
  const byNumber = (a: Slot, b: Slot) => a.number - b.number
  const preselected = config.preselected ? layout.slots.get(config.preselected) : undefined
  const selected = free(preselected ? [preselected] : [])[0] ?? free(slots)[0]
  if (!selected) throw new Error(`${config.id} : aucun fauteuil libre à montrer`)
  const front = free(layout.rows[0].slots).sort(byNumber)[0] ?? selected
  const back = free(layout.rows[layout.rows.length - 1].slots).sort(byNumber).at(-1) ?? selected

  const metrics = viewMetrics(layout, selected)

  return {
    name: config.name,
    description:
      config.description ?? `${layout.rows.length} rangs, ${layout.seatCount} places.`,
    places: layout.seatCount,
    rows: layout.rows.map((row) => row.label),
    seats: slots.map((slot) => ({
      id: slot.id,
      row: slot.rowIndex,
      number: slot.number,
      span: slot.span,
      pmr: slot.kind === 'pmr',
      busy: slot.occupied,
      x: slot.position[0],
      y: slot.position[1],
      z: slot.position[2],
    })),
    selected: selected.id,
    front: front.id,
    back: back.id,
    pmrCount: slots.filter((slot) => slot.kind === 'pmr').length,
    doubleCount: layout.doubleCount,
    doubleRows: layout.rows.filter((row) => row.slots.some((slot) => slot.span === 2)).length,
    dim: {
      screenW: layout.screen.width,
      screenH: layout.screen.height,
      screenBottom: layout.screen.bottom,
      firstRow: d.screenToFirstRow,
      rowGap: d.rowSpacing,
      seatW: d.seatWidth,
      step: d.stepHeight,
      eye: EYE_HEIGHT,
    },
    box: {
      halfWidth: layout.shell.width / 2,
      height: layout.shell.height,
      depth: layout.shell.depth,
    },
    distance: metrics.distance,
    angle: metrics.horizontalAngle,
    slope: (Math.atan2(d.stepHeight, d.rowSpacing) * 180) / Math.PI,
  }
}

export const halls: Hall[] = layouts.map(toHall)

/** Nombre à la française : virgule décimale. */
export const fr = (value: number, digits = 0) => value.toFixed(digits).replace('.', ',')

/** « 9,40 × 3,93 m » */
export const screenSize = (hall: Hall) =>
  `${fr(hall.dim.screenW, 2)} × ${fr(hall.dim.screenH, 2)} m`
