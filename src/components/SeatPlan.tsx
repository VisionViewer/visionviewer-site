import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Accessibility, Minus, Plus, ZoomIn } from 'lucide-react'
import type { RoomLayout, Slot } from '../lib/room'
import { useSpringValue } from '../lib/useSpringValue'
import './SeatPlan.css'

const ZOOM_STEPS = [1, 1.35, 1.8, 2.4, 3.2]
/** En dessous de cette taille (px), un siège est difficile à viser du doigt */
const MIN_COMFORT_CELL = 17
const MAX_VIEWPORT_HEIGHT = 440
/** Ressort du zoom : vif, sans rebond */
const ZOOM_SPRING = { stiffness: 320, damping: 34, mass: 0.9 }
/** Doit correspondre au padding et à la largeur des lettres de rangée dans SeatPlan.css */
const MAP_PADDING = 12
const ROW_LABEL_WIDTH = 18

interface SeatPlanProps {
  layout: RoomLayout
  selectedId: string | null
  onSelect: (id: string) => void
  /** Touche sur un emplacement PMR (non réservable en ligne) */
  onPmr: () => void
}

export default function SeatPlan({ layout, selectedId, onSelect, onPmr }: SeatPlanProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const appliedScale = useRef(1)
  /** Point du plan (coordonnées au zoom 1) à garder au centre pendant un zoom au toucher */
  const focus = useRef<{ x: number; y: number } | null>(null)

  const [baseWidth, setBaseWidth] = useState(0)
  // Le plan s'ouvre toujours dézoomé : on voit d'abord toute la disposition de la salle
  const [step, setStep] = useState(0)

  // Largeur disponible → taille d'un siège au zoom 1 (plan entier visible)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setBaseWidth(viewport.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const cell = baseWidth
    ? (baseWidth - 2 * MAP_PADDING - 2 * ROW_LABEL_WIDTH) / layout.planWidth
    : 0

  /** Premier niveau de zoom où les sièges sont assez grands pour être touchés sans erreur */
  const comfortStep = useMemo(() => {
    if (!cell) return 0
    const index = ZOOM_STEPS.findIndex((z) => cell * z >= MIN_COMFORT_CELL)
    return index === -1 ? ZOOM_STEPS.length - 1 : index
  }, [cell])

  const zoom = ZOOM_STEPS[step]
  const targetZoom = useRef(zoom)
  targetZoom.current = zoom
  /** Sièges trop petits pour le doigt au zoom actuel : un toucher zoome au lieu de sélectionner */
  const tiny = cell > 0 && step < comfortStep
  /**
   * Applique un facteur de zoom en conservant le centre de la zone visible
   * (ou le point touché, lors d'un zoom au toucher).
   * On utilise la propriété CSS `zoom` (et non `transform`) : la zone défilable
   * suit la taille réelle du plan et les lettres de rangée peuvent rester collées aux bords.
   */
  const applyScale = useCallback(
    (s: number) => {
      const viewport = viewportRef.current
      const sizer = sizerRef.current
      const map = mapRef.current
      if (!viewport || !sizer || !map || !baseWidth) return

      const previous = appliedScale.current
      const mapHeight = sizer.offsetHeight / previous
      const center = focus.current ?? {
        x: (viewport.scrollLeft + baseWidth / 2) / previous,
        y: (viewport.scrollTop + viewport.clientHeight / 2) / previous,
      }

      // Dézoomé, le cadre épouse le plan ; zoomé, il grandit jusqu'à une hauteur maximale
      const viewportHeight = Math.min(mapHeight * s, MAX_VIEWPORT_HEIGHT)
      viewport.style.height = `${viewportHeight}px`
      map.style.zoom = String(s)
      viewport.scrollLeft = center.x * s - baseWidth / 2
      viewport.scrollTop = center.y * s - viewportHeight / 2
      appliedScale.current = s
      // Zoom terminé : le plan redevient libre de défiler
      if (Math.abs(s - targetZoom.current) < 0.002) focus.current = null
    },
    [baseWidth],
  )

  const scale = useSpringValue(1, ZOOM_SPRING, applyScale)

  useLayoutEffect(() => {
    if (baseWidth) applyScale(scale.get())
  }, [baseWidth, applyScale, scale])

  useEffect(() => {
    scale.set(zoom)
  }, [zoom, scale])

  // Glisser à la souris pour déplacer le plan zoomé (au doigt : défilement natif)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const lastPointerType = useRef('mouse')

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false
    lastPointerType.current = e.pointerType
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const viewport = viewportRef.current
    if (!d || !viewport || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return
      d.moved = true
      suppressClick.current = true
      viewport.setPointerCapture(e.pointerId)
    }
    viewport.scrollLeft -= dx
    viewport.scrollTop -= dy
    d.x = e.clientX
    d.y = e.clientY
  }
  const onPointerEnd = () => {
    drag.current = null
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Fin d'un glisser à la souris : ce n'est pas un clic sur un siège
    if (suppressClick.current) {
      suppressClick.current = false
      e.stopPropagation()
      e.preventDefault()
      return
    }
    // Au doigt, sur un plan trop petit : le premier toucher zoome là où l'on a touché
    if (tiny && lastPointerType.current !== 'mouse' && sizerRef.current) {
      const rect = sizerRef.current.getBoundingClientRect()
      focus.current = {
        x: (e.clientX - rect.left) / appliedScale.current,
        y: (e.clientY - rect.top) / appliedScale.current,
      }
      setStep(comfortStep)
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const rowsBackToFront = useMemo(() => [...layout.rows].reverse(), [layout])
  const mirrored = layout.config.seatOneSide === 'right'
  const mapStyle = { width: baseWidth, '--cell': `${cell}px` } as CSSProperties

  return (
    <section className="plan" aria-label={`Plan de la salle ${layout.config.name}`}>
      <div className="plan__toolbar">
        <div className="plan__heading">
          <p className="plan__caption">
            {layout.config.name} · {layout.seatCount} places
          </p>
          {/* Visible uniquement sur écran tactile (voir SeatPlan.css) */}
          {tiny && (
            <p className="plan__hint">
              <ZoomIn aria-hidden size={14} strokeWidth={2.4} />
              Touchez le plan pour zoomer
            </p>
          )}
        </div>
        <div className="plan__zoom">
          <button
            type="button"
            className="zoom-btn"
            aria-label="Zoom arrière"
            disabled={step === 0}
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            <Minus aria-hidden size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="zoom-btn"
            aria-label="Zoom avant"
            disabled={step === ZOOM_STEPS.length - 1}
            onClick={() => setStep(Math.min(ZOOM_STEPS.length - 1, step + 1))}
          >
            <Plus aria-hidden size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`plan__viewport${zoom > 1 ? ' plan__viewport--zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <div ref={sizerRef} className="plan__sizer">
          <div ref={mapRef} className="plan__map" style={mapStyle}>
            {cell > 0 && (
              <>
                {rowsBackToFront.map((row) => (
                  <div className="plan__row" key={row.label}>
                    <span className="plan__rowlabel" aria-hidden>
                      {row.label}
                    </span>
                    <div className="plan__seats">
                      {row.slots.map((slot) =>
                        slot.kind === 'empty' ? null : (
                          <Seat
                            key={slot.id}
                            slot={slot}
                            selected={slot.id === selectedId}
                            mirrored={mirrored}
                            delay={Math.round(
                              row.index * 26 +
                                Math.abs(slot.planX + slot.span / 2 - layout.planWidth / 2) * 14,
                            )}
                            onSelect={onSelect}
                            onPmr={onPmr}
                          />
                        ),
                      )}
                    </div>
                    <span className="plan__rowlabel" aria-hidden>
                      {row.label}
                    </span>
                  </div>
                ))}
                <div className="plan__screen" aria-hidden>
                  <svg viewBox="0 0 300 22" preserveAspectRatio="none">
                    <path d="M2 3 Q150 34 298 3" />
                  </svg>
                  <span>ECRAN</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

interface SeatProps {
  slot: Slot
  selected: boolean
  /** Fauteuil n°1 à droite du plan : les numéros d'une place double s'affichent dans l'autre sens */
  mirrored: boolean
  delay: number
  onSelect: (id: string) => void
  onPmr: () => void
}

const Seat = memo(function Seat({ slot, selected, mirrored, delay, onSelect, onPmr }: SeatProps) {
  const style = {
    '--x': slot.planX,
    '--span': slot.span,
    '--delay': `${delay}ms`,
  } as CSSProperties

  if (slot.kind === 'pmr') {
    return (
      <button
        type="button"
        className="seat seat--pmr"
        style={style}
        aria-label={`Emplacement PMR, rangée ${slot.row} : réservation à l'accueil`}
        onClick={onPmr}
      >
        <span className="seat__shape">
          <Accessibility aria-hidden />
        </span>
      </button>
    )
  }

  const double = slot.span === 2
  const state = slot.occupied ? 'occupied' : selected ? 'selected' : 'free'
  const stateLabel = slot.occupied
    ? double
      ? 'occupée'
      : 'occupé'
    : selected
      ? double
        ? 'sélectionnée'
        : 'sélectionné'
      : 'libre'
  // Numéros affichés de gauche à droite du plan
  const numbers = double
    ? mirrored
      ? [slot.number + 1, slot.number]
      : [slot.number, slot.number + 1]
    : [slot.number]

  return (
    <button
      type="button"
      className={`seat seat--${state}${double ? ' seat--double' : ''}`}
      style={style}
      data-seat-id={slot.id}
      disabled={slot.occupied}
      aria-pressed={slot.occupied ? undefined : selected}
      aria-label={`${double ? 'Place double' : 'Fauteuil'} ${slot.id}, ${stateLabel}`}
      onClick={() => {
        // Petit retour haptique là où il existe (Android)
        if (!selected) navigator.vibrate?.(8)
        onSelect(slot.id)
      }}
    >
      <span className="seat__shape">
        {numbers.map((n) => (
          <span className="seat__label" key={n}>
            {n}
          </span>
        ))}
      </span>
    </button>
  )
})
