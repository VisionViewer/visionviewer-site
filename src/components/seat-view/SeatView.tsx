import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, useReducedMotion, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LocateFixed,
  MoveHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { t } from '../../lib/langue'
import { neighborSeat, type Direction, type RoomLayout, type Slot } from '../../lib/room'
import type { Point } from '../BookingScreen'
import './SeatView.css'

// La scène 3D (three.js) est chargée à la demande pour garder l'écran de réservation léger
const loadScene = () => import('./Scene')
const Scene = lazy(loadScene)

/** À appeler dès qu'un siège est sélectionné, pour que la vue 3D s'ouvre sans attente. */
export function preloadSeatView() {
  loadScene().catch(() => {
    // Hors ligne : l'erreur sera affichée proprement à l'ouverture de la vue
  })
}

interface SeatViewProps {
  layout: RoomLayout
  /** Siège depuis lequel la vue s'ouvre */
  slot: Slot
  /** Point de l'écran d'où part la révélation circulaire */
  origin: Point
  onBack: () => void
  /** `seatId` : le siège regardé au moment du choix (on peut en changer depuis la vue) */
  onChoose: (seatId: string) => void
}

const EASE = [0.65, 0, 0.35, 1] as const
const spring = { type: 'spring', stiffness: 420, damping: 34 } as const

/** Rayon nécessaire pour qu'un cercle centré en `p` couvre toute la fenêtre. */
function coverRadius(p: Point): number {
  return Math.hypot(
    Math.max(p.x, window.innerWidth - p.x),
    Math.max(p.y, window.innerHeight - p.y),
  )
}

const circle = (radius: number, p: Point) => `circle(${radius}px at ${p.x}px ${p.y}px)`

export default function SeatView({ layout, slot, origin, onBack, onChoose }: SeatViewProps) {
  const reducedMotion = useReducedMotion() ?? false
  const [ready, setReady] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [failed, setFailed] = useState(false)
  const [hint, setHint] = useState(true)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const backRef = useRef<HTMLButtonElement>(null)

  // Siège regardé : celui d'ouverture, puis ses voisins si l'on se déplace depuis la vue
  const [currentId, setCurrentId] = useState(slot.id)
  const current = layout.slots.get(currentId) ?? slot
  const viewTitle = t({
    en: current.span === 2 ? 'View from double seat' : 'View from seat',
    fr: current.span === 2 ? 'Vue depuis la place double' : 'Vue depuis le fauteuil',
  })
  const neighbors = useMemo(
    () => ({
      forward: neighborSeat(layout, current, 'forward'),
      back: neighborSeat(layout, current, 'back'),
      left: neighborSeat(layout, current, 'left'),
      right: neighborSeat(layout, current, 'right'),
    }),
    [layout, current],
  )
  const moveTo = (direction: Direction) => {
    const next = neighbors[direction]
    if (!next) return
    navigator.vibrate?.(6)
    setHint(false)
    setCurrentId(next.id)
  }

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  // L'astuce disparaît au premier mouvement de tête, ou d'elle-même après quelques secondes
  useEffect(() => {
    if (!arrived || !hint) return
    const timer = window.setTimeout(() => setHint(false), 7000)
    return () => window.clearTimeout(timer)
  }, [arrived, hint])

  const handleReady = useCallback(() => setReady(true), [])
  const handleArrive = useCallback(() => setArrived(true), [])
  const handleLook = useCallback(() => setHint(false), [])
  const handleError = useCallback(() => setFailed(true), [])

  const overlay = useMemo<Variants>(() => {
    if (reducedMotion) {
      return {
        enter: { opacity: 0 },
        shown: { opacity: 1, transition: { duration: 0.2, delayChildren: 0.1 } },
        exit: { opacity: 0, transition: { duration: 0.2 } },
      }
    }
    return {
      enter: { clipPath: circle(0, origin) },
      shown: {
        clipPath: circle(coverRadius(origin), origin),
        transition: {
          clipPath: { duration: 0.8, ease: EASE },
          delayChildren: 0.45,
          staggerChildren: 0.08,
        },
        transitionEnd: { clipPath: 'none' },
      },
      // `target` : centre du siège sur le plan, fourni par AnimatePresence à la fermeture
      exit: (target: Point | null) => {
        const p = target ?? origin
        return {
          clipPath: [circle(coverRadius(p), p), circle(0, p)],
          transition: { duration: 0.6, ease: EASE },
        }
      },
    }
  }, [origin, reducedMotion])

  return (
    <m.div
      className="seat-view"
      role="dialog"
      aria-modal="true"
      aria-label={`${viewTitle} ${current.id}`}
      variants={overlay}
      initial="enter"
      animate="shown"
      exit="exit"
    >
      <div className="seat-view__canvas">
        <SceneBoundary onError={handleError}>
          <Suspense fallback={null}>
            <Scene
              layout={layout}
              slot={current}
              introSlot={slot}
              skipIntro={reducedMotion}
              recenterSignal={recenterSignal}
              onReady={handleReady}
              onArrive={handleArrive}
              onLook={handleLook}
            />
          </Suspense>
        </SceneBoundary>
      </div>

      <AnimatePresence>
        {!ready && !failed && (
          <m.div
            key="loader"
            className="seat-view__loader"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="loader-bars" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{t({ en: 'Taking your seat…', fr: 'Installation dans la salle…' })}</span>
          </m.div>
        )}
      </AnimatePresence>

      {failed && (
        <div className="seat-view__error" role="alert">
          <TriangleAlert aria-hidden size={30} strokeWidth={1.8} />
          <strong>
            {t({ en: "The 3D view couldn't be displayed", fr: "La vue 3D n'a pas pu s'afficher" })}
          </strong>
          <span>
            {t({
              en: "This device or browser can't display the auditorium in 3D. You can still choose this seat.",
              fr: "Cet appareil ou ce navigateur ne permet pas d'afficher la salle en 3D. Vous pouvez tout de même choisir ce siège.",
            })}
          </span>
        </div>
      )}

      <div className="seat-view__scrim seat-view__scrim--top" aria-hidden />
      <div className="seat-view__scrim seat-view__scrim--bottom" aria-hidden />

      <div className="hud-top">
        <m.button
          ref={backRef}
          type="button"
          className="glass-btn"
          variants={hudItem}
          whileTap={{ scale: 0.94 }}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden size={20} strokeWidth={2.4} />
          {t({ en: 'Seat map', fr: 'Plan' })}
        </m.button>

        <m.div className="hud-title" variants={hudItem} aria-live="polite">
          <span className="hud-title__eyebrow">{viewTitle}</span>
          <span className="hud-title__seat">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={current.id}
                initial={{ y: 18, opacity: 0, filter: 'blur(5px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -18, opacity: 0, filter: 'blur(5px)' }}
                transition={spring}
              >
                {current.id}
              </m.span>
            </AnimatePresence>
          </span>
        </m.div>

        <m.button
          type="button"
          className="glass-btn glass-btn--icon"
          aria-label={t({
            en: 'Recenter the view on the screen',
            fr: "Recentrer le regard sur l'écran",
          })}
          variants={hudItem}
          whileTap={{ scale: 0.9, rotate: -30 }}
          disabled={failed}
          onClick={() => setRecenterSignal((n) => n + 1)}
        >
          <LocateFixed aria-hidden size={20} strokeWidth={2.2} />
        </m.button>
      </div>

      <div className="hud-bottom">
        <div className="hud-bottom__row">
          <div className="hud-hint-slot">
            <AnimatePresence>
              {arrived && hint && (
                <m.p
                  key="hint"
                  className="hud-hint"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.35 }}
                >
                  <m.span
                    className="hud-hint__icon"
                    animate={{ x: [-4, 4, -4] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <MoveHorizontal aria-hidden size={18} strokeWidth={2.2} />
                  </m.span>
                  {t({ en: 'Drag to look around', fr: 'Glissez pour tourner la tête' })}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          {/* Changer de siège sans repasser par le plan : flèches du point de vue du spectateur */}
          <AnimatePresence>
            {arrived && !failed && (
              <m.div
                key="seat-nav"
                className="seat-nav"
                role="group"
                aria-label={t({
                  en: 'Compare with a nearby seat',
                  fr: 'Comparer avec un siège voisin',
                })}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={spring}
              >
                <NavButton
                  area="forward"
                  label={t({ en: 'Row in front', fr: 'Rangée de devant' })}
                  target={neighbors.forward}
                  onMove={moveTo}
                >
                  <ChevronUp aria-hidden size={22} strokeWidth={2.6} />
                </NavButton>
                <NavButton
                  area="left"
                  label={t({ en: 'Seat to the left', fr: 'Siège de gauche' })}
                  target={neighbors.left}
                  onMove={moveTo}
                >
                  <ChevronLeft aria-hidden size={22} strokeWidth={2.6} />
                </NavButton>
                <span className="seat-nav__center" aria-hidden />
                <NavButton
                  area="right"
                  label={t({ en: 'Seat to the right', fr: 'Siège de droite' })}
                  target={neighbors.right}
                  onMove={moveTo}
                >
                  <ChevronRight aria-hidden size={22} strokeWidth={2.6} />
                </NavButton>
                <NavButton
                  area="back"
                  label={t({ en: 'Row behind', fr: 'Rangée de derrière' })}
                  target={neighbors.back}
                  onMove={moveTo}
                >
                  <ChevronDown aria-hidden size={22} strokeWidth={2.6} />
                </NavButton>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <m.button
          type="button"
          className="choose-btn"
          variants={hudItem}
          whileTap={{ scale: 0.97 }}
          onClick={() => onChoose(current.id)}
        >
          <Check aria-hidden size={22} strokeWidth={2.8} />
          {t({ en: 'Choose this seat', fr: 'Choisir ce siège' })}
        </m.button>
      </div>
    </m.div>
  )
}

const hudItem: Variants = {
  enter: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

function NavButton({
  area,
  label,
  target,
  onMove,
  children,
}: {
  area: Direction
  label: string
  target: Slot | undefined
  onMove: (direction: Direction) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`seat-nav__btn seat-nav__btn--${area}`}
      aria-label={
        target
          ? t({ en: `${label}: ${target.id}`, fr: `${label} : ${target.id}` })
          : t({ en: `${label}: no seat available`, fr: `${label} : aucun fauteuil libre` })
      }
      disabled={!target}
      onClick={() => onMove(area)}
    >
      {children}
    </button>
  )
}

/** Rattrape un échec de la scène 3D (WebGL indisponible, chargement interrompu…). */
class SceneBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[VisionViewer] Vue 3D indisponible :', error)
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
