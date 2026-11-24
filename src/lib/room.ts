/**
 * Description d'une salle (fichier JSON) et calcul de son « layout ».
 *
 * Le layout est la source unique utilisée à la fois par le plan 2D
 * (`planX`, `rowIndex`) et par la scène 3D (`position` en mètres).
 *
 * Repère 3D (mètres) :
 *   - l'écran est dans le plan z = 0, les spectateurs sont en z > 0 et regardent vers -z ;
 *   - x > 0 = droite du spectateur, x < 0 = sa gauche ; x = 0 = axe de l'écran ;
 *   - y = hauteur, y = 0 au sol du premier rang.
 *
 * Le plan 2D est une vue de dessus avec l'écran en bas : la gauche du plan
 * correspond donc à la DROITE du spectateur assis face à l'écran.
 */

export interface RoomDimensions {
  /** Largeur de l'écran (m) */
  screenWidth: number
  /** Hauteur de l'écran (m) */
  screenHeight: number
  /** Hauteur du bas de l'écran au-dessus du sol du premier rang (m). Défaut : 1.2 */
  screenBottomHeight?: number
  /** Distance entre l'écran et les yeux du premier rang (m) */
  screenToFirstRow: number
  /** Espacement entre deux rangées (m) */
  rowSpacing: number
  /** Largeur d'un siège, d'axe en axe (m) */
  seatWidth: number
  /** Hauteur d'une marche du gradin, par rangée (m) */
  stepHeight: number
  /** Largeur d'une allée intérieure (m). Défaut : 1.1 */
  aisleWidth?: number
}

export interface RoomConfig {
  id: string
  name: string
  /** Rangées, de la plus proche de l'écran à la plus éloignée */
  rows: string[]
  /** Nombre d'emplacements par rangée (numérotés de 1 à n) */
  seatsPerRow: number
  /** Côté du fauteuil n°1 sur le plan 2D (écran en bas). Défaut : "left" */
  seatOneSide?: 'left' | 'right'
  /** Allées intérieures : une allée est insérée après chaque numéro indiqué */
  aislesAfter?: number[]
  /**
   * Exceptions par rangée, par numéros de position :
   *   - `empty` : emplacements sans fauteuil ;
   *   - `pmr` : emplacements PMR ;
   *   - `double` : places doubles. Chaque numéro est la première des deux positions
   *     occupées : `[1, 3]` crée les places doubles 1-2 et 3-4.
   */
  rowOverrides?: Record<string, { empty?: number[]; pmr?: number[]; double?: number[] }>
  /** Sièges déjà occupés, ex. ["I7", "I8"] ; une place double se note "R1-2" */
  occupied?: string[]
  /** Siège présélectionné à l'ouverture */
  preselected?: string
  /** Prix d'une place (€) */
  price: number
  /** Image projetée sur l'écran, relative au dossier `public/`. Sans image, l'écran est blanc */
  screenImage?: string
  /**
   * Logo projeté au centre de l'écran, qui reste blanc autour de lui ; relatif au dossier `public/`.
   * Dans la démo : l'emplacement « Votre logo ici ». Sans effet si `screenImage` est donné.
   * Une autre langue peut avoir le sien, dans `traductions` (voir `roomScreenLogo`).
   */
  screenLogo?: string
  /** Une phrase qui décrit la salle, affichée par la page de présentation */
  description?: string
  /**
   * Le nom, la description et le logo de l'écran de la salle dans d'autres langues que celle du
   * fichier, par code de langue : `{ "en": { "name": "Auditorium 1", "description": "…",
   * "screenLogo": "screens/your-logo-here.png" } }`. Voir `roomTexts` et `roomScreenLogo`.
   */
  traductions?: Record<string, { name?: string; description?: string; screenLogo?: string }>
  dimensions: RoomDimensions
}

export type SlotKind = 'seat' | 'pmr' | 'empty'

export interface Slot {
  /** Identifiant affiché, ex. "G9", ou "R1-2" pour une place double */
  id: string
  row: string
  /** 0 = rangée la plus proche de l'écran */
  rowIndex: number
  /** Numéro de position dans la rangée (1..seatsPerRow) ; la première pour une place double */
  number: number
  /** Nombre de positions occupées, donc de places vendues : 2 pour une place double */
  span: 1 | 2
  kind: SlotKind
  occupied: boolean
  /** Abscisse du bord gauche dans le plan 2D, en largeurs de siège */
  planX: number
  /** Position 3D du centre du siège en mètres : [x, y du sol de la rangée, z depuis l'écran] */
  position: readonly [number, number, number]
}

export interface RowLayout {
  label: string
  index: number
  /** Emplacements ordonnés de la gauche vers la droite du plan */
  slots: Slot[]
}

export interface AisleLayout {
  /** Centre de l'allée (m) */
  x: number
  /** Largeur (m) */
  width: number
}

export interface RoomLayout {
  config: RoomConfig
  rows: RowLayout[]
  slots: Map<string, Slot>
  /** Largeur du plan 2D, en largeurs de siège */
  planWidth: number
  /** Bloc de sièges (m) */
  seating: { width: number }
  /** Volume de la salle (m). La salle s'étend de z = 0 (écran) à z = depth */
  shell: { width: number; depth: number; height: number }
  screen: { width: number; height: number; bottom: number; centerY: number }
  /** Allées (intérieures + latérales), pour la scène 3D */
  aisles: AisleLayout[]
  /** Nombre de places (une place double compte pour deux) */
  seatCount: number
  /** Nombre de places encore libres */
  freeCount: number
  /** Nombre de places doubles */
  doubleCount: number
}

/** Largeur d'une allée intérieure dans le plan 2D, en largeurs de siège */
const PLAN_AISLE_UNITS = 0.9
/** Circulation minimale le long des murs latéraux (m) */
const SIDE_AISLE = 1.25
/** Espace derrière la dernière rangée (m) */
const BACK_MARGIN = 1.6
/** Recul du nez de marche devant chaque rangée (m) : la place pour les pieds */
export const FOOTWELL = 0.62
/** Le mur d'écran est légèrement en retrait du plan de l'écran (m) */
export const FRONT_WALL_Z = -0.45

export function buildLayout(config: RoomConfig): RoomLayout {
  const d = config.dimensions
  const n = config.seatsPerRow
  const aisleWidth = d.aisleWidth ?? 1.1
  const aislesAfter = [...new Set(config.aislesAfter ?? [])]
    .filter((a) => a >= 1 && a < n)
    .sort((a, b) => a - b)
  const mirror = config.seatOneSide === 'right'

  const seatingWidth = n * d.seatWidth + aislesAfter.length * aisleWidth
  const planWidth = n + aislesAfter.length * PLAN_AISLE_UNITS
  const occupied = new Set(config.occupied ?? [])

  const slots = new Map<string, Slot>()
  const rows: RowLayout[] = config.rows.map((label, rowIndex) => {
    const override = config.rowOverrides?.[label]
    const empty = new Set(override?.empty ?? [])
    const pmr = new Set(override?.pmr ?? [])
    const doubles = validDoubles(config.id, label, override?.double ?? [], n, empty, pmr, aislesAfter)
    const rowSlots: Slot[] = []

    // Emplacement d'une position : distances mesurées depuis le côté du fauteuil n°1,
    // puis ramenées au bord gauche du plan
    const place = (number: number) => {
      const aislesBefore = aislesAfter.filter((a) => a < number).length
      let planX = number - 1 + aislesBefore * PLAN_AISLE_UNITS
      let across = (number - 0.5) * d.seatWidth + aislesBefore * aisleWidth
      if (mirror) {
        planX = planWidth - 1 - planX
        across = seatingWidth - across
      }
      return { planX, across }
    }

    for (let number = 1; number <= n; number++) {
      // Une place double occupe cette position et la suivante
      const span = doubles.has(number) ? 2 : 1
      const first = place(number)
      const last = span === 2 ? place(number + 1) : first

      const id = span === 2 ? `${label}${number}-${number + 1}` : `${label}${number}`
      const kind: SlotKind = empty.has(number) ? 'empty' : pmr.has(number) ? 'pmr' : 'seat'
      const slot: Slot = {
        id,
        row: label,
        rowIndex,
        number,
        span,
        kind,
        occupied: kind === 'seat' && occupied.has(id),
        planX: Math.min(first.planX, last.planX),
        position: [
          // Gauche du plan = droite du spectateur (x > 0)
          seatingWidth / 2 - (first.across + last.across) / 2,
          rowIndex * d.stepHeight,
          d.screenToFirstRow + rowIndex * d.rowSpacing,
        ],
      }
      rowSlots.push(slot)
      slots.set(id, slot)
      if (span === 2) number++
    }

    rowSlots.sort((a, b) => a.planX - b.planX)
    return { label, index: rowIndex, slots: rowSlots }
  })

  const screenBottom = d.screenBottomHeight ?? 1.2
  const screen = {
    width: d.screenWidth,
    height: d.screenHeight,
    bottom: screenBottom,
    centerY: screenBottom + d.screenHeight / 2,
  }

  const lastRowFloor = (config.rows.length - 1) * d.stepHeight
  const shell = {
    width: Math.max(seatingWidth + 2 * SIDE_AISLE, d.screenWidth + 1.2),
    depth: d.screenToFirstRow + (config.rows.length - 1) * d.rowSpacing + BACK_MARGIN,
    height: Math.max(screen.bottom + screen.height + 0.7, lastRowFloor + 2.9),
  }

  const sideGap = (shell.width - seatingWidth) / 2
  const aisles: AisleLayout[] = [
    { x: -(seatingWidth + sideGap) / 2, width: sideGap },
    { x: (seatingWidth + sideGap) / 2, width: sideGap },
    ...aislesAfter.map((after, i) => {
      // Centre de l'allée, mesuré depuis le côté du fauteuil n°1 puis depuis la gauche du plan
      const fromSeatOne = after * d.seatWidth + i * aisleWidth + aisleWidth / 2
      const across = mirror ? seatingWidth - fromSeatOne : fromSeatOne
      return { x: seatingWidth / 2 - across, width: aisleWidth }
    }),
  ]

  const seats = [...slots.values()].filter((s) => s.kind === 'seat')
  const layout: RoomLayout = {
    config,
    rows,
    slots,
    planWidth,
    seating: { width: seatingWidth },
    shell,
    screen,
    aisles,
    seatCount: places(seats),
    freeCount: places(seats.filter((s) => !s.occupied)),
    doubleCount: seats.filter((s) => s.span === 2).length,
  }

  warnOnInconsistencies(layout)
  return layout
}

const places = (seats: Slot[]) => seats.reduce((total, seat) => total + seat.span, 0)

/** Places doubles valides d'une rangée (numéro de leur première position) ; les autres sont signalées. */
function validDoubles(
  roomId: string,
  row: string,
  starts: number[],
  seatsPerRow: number,
  empty: Set<number>,
  pmr: Set<number>,
  aislesAfter: number[],
): Set<number> {
  const valid = new Set<number>()
  for (const start of [...new Set(starts)].sort((a, b) => a - b)) {
    const taken = (n: number) => empty.has(n) || pmr.has(n)
    const problem =
      start < 1 || start >= seatsPerRow
        ? 'elle dépasse de la rangée'
        : taken(start) || taken(start + 1)
          ? 'elle recouvre un emplacement vide ou PMR'
          : aislesAfter.includes(start)
            ? 'elle est à cheval sur une allée'
            : valid.has(start - 1)
              ? 'elle chevauche la place double précédente'
              : null
    if (problem) {
      console.warn(
        `[${roomId}] rowOverrides.${row}.double : la place ${start}-${start + 1} est ignorée, ${problem}.`,
      )
    } else {
      valid.add(start)
    }
  }
  return valid
}

/** Signale dans la console les erreurs de saisie les plus courantes d'un JSON de salle. */
function warnOnInconsistencies({ config, slots }: RoomLayout) {
  const check = (id: string, field: string) => {
    const slot = slots.get(id)
    if (!slot) console.warn(`[${config.id}] ${field} : le siège « ${id} » n'existe pas.`)
    else if (slot.kind !== 'seat')
      console.warn(`[${config.id}] ${field} : « ${id} » n'est pas un fauteuil (${slot.kind}).`)
  }
  config.occupied?.forEach((id) => check(id, 'occupied'))
  if (config.preselected) check(config.preselected, 'preselected')
  for (const row of Object.keys(config.rowOverrides ?? {})) {
    if (!config.rows.includes(row))
      console.warn(`[${config.id}] rowOverrides : la rangée « ${row} » n'existe pas.`)
  }
}

/** Un siège peut-il être choisi par l'utilisateur ? */
export function isSelectable(slot: Slot | undefined): slot is Slot {
  return !!slot && slot.kind === 'seat' && !slot.occupied
}

/** « Fauteuil G9 » ou « Place double R1-2 » */
export function seatName(slot: Slot): string {
  return `${slot.span === 2 ? 'Place double' : 'Fauteuil'} ${slot.id}`
}

/** Directions du point de vue du spectateur assis face à l'écran */
export type Direction = 'left' | 'right' | 'forward' | 'back'

/**
 * Fauteuil libre le plus proche dans une direction donnée : voisin de gauche ou
 * de droite dans la même rangée, ou siège le mieux aligné de la rangée devant
 * (`forward`, vers l'écran) ou derrière. Les places occupées, PMR et vides sont sautées.
 */
export function neighborSeat(
  layout: RoomLayout,
  from: Slot,
  direction: Direction,
): Slot | undefined {
  const offset = (slot: Slot) => slot.position[0] - from.position[0]
  const nearest = (slots: Slot[]) =>
    slots.sort((a, b) => Math.abs(offset(a)) - Math.abs(offset(b)))[0]

  if (direction === 'left' || direction === 'right') {
    const sign = direction === 'right' ? 1 : -1
    return nearest(
      layout.rows[from.rowIndex].slots.filter((s) => isSelectable(s) && offset(s) * sign > 1e-6),
    )
  }

  const step = direction === 'back' ? 1 : -1
  for (let row = from.rowIndex + step; row >= 0 && row < layout.rows.length; row += step) {
    const candidate = nearest(layout.rows[row].slots.filter(isSelectable))
    if (candidate) return candidate
  }
  return undefined
}

/**
 * Le nom et la description d'une salle dans une langue : sa traduction (champ `traductions`), à
 * défaut ses valeurs d'origine. Une description absente le reste : à l'appelant d'en écrire une.
 */
export function roomTexts(config: RoomConfig, langue: string): { name: string; description?: string } {
  const traduction = config.traductions?.[langue]
  return { name: traduction?.name ?? config.name, description: traduction ? traduction.description : config.description }
}

/**
 * Le logo projeté sur l'écran d'une salle dans une langue : celui de sa traduction (« YOUR LOGO
 * HERE » en anglais), à défaut celui du fichier (« VOTRE LOGO ICI »).
 */
export function roomScreenLogo(config: RoomConfig, langue: string): string | undefined {
  return config.traductions?.[langue]?.screenLogo ?? config.screenLogo
}
