import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, LazyMotion, MotionConfig } from 'motion/react'
import { layouts } from './data/rooms'
import { t } from './lib/langue'
import { notify, Toaster } from './lib/notify'
import { isSelectable, seatName } from './lib/room'
import { useWideLayout } from './lib/useWideLayout'
import BookingScreen, { type Point } from './components/BookingScreen'
import DemoBar from './components/DemoBar'
import DetailsSheet from './components/DetailsSheet'
import SeatView, { preloadSeatView } from './components/seat-view/SeatView'

// Chargés après le premier affichage, pour qu'il n'ait pas à les attendre :
// le moteur d'animation, et le panneau de démo (avec son QR code), utile sur ordinateur seulement
const loadMotionFeatures = () => import('./lib/motionFeatures').then((module) => module.default)
const DemoAside = lazy(() => import('./components/DemoAside'))

/** Centre du siège sur le plan 2D, s'il est visible : la vue 3D s'y referme. */
function seatCenterOnPlan(seatId: string): Point | null {
  const el = document.querySelector<HTMLElement>(`[data-seat-id="${CSS.escape(seatId)}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const visible = x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight
  return visible ? { x, y } : null
}

export default function App() {
  const [roomId, setRoomId] = useState(layouts[0].config.id)
  const layout = layouts.find((l) => l.config.id === roomId) ?? layouts[0]

  // Une sélection par salle, initialisée avec le siège présélectionné du JSON
  const [selections, setSelections] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      layouts.map((l) => {
        const pre = l.config.preselected
        return [l.config.id, pre && isSelectable(l.slots.get(pre)) ? pre : null]
      }),
    ),
  )
  const selectedId = selections[layout.config.id] ?? null
  const selected = selectedId ? layout.slots.get(selectedId) : undefined

  const reservedMessage = selected
    ? t({
        en: `${selected.span === 2 ? 'Double seat' : 'Seat'} ${selected.id} booked`,
        fr: `${seatName(selected)} ${selected.span === 2 ? 'réservée' : 'réservé'}`,
      })
    : ''

  const [detailsOpen, setDetailsOpen] = useState(false)

  // Sur ordinateur, la démo est présentée dans un téléphone, à côté de son panneau
  const wide = useWideLayout()
  // Vue 3D : siège affiché + point de départ de la transition
  const [view, setView] = useState<{ seatId: string; origin: Point } | null>(null)
  const [exitTarget, setExitTarget] = useState<Point | null>(null)
  const viewSlot = view ? layout.slots.get(view.seatId) : undefined

  const select = useCallback(
    (id: string) => {
      if (!isSelectable(layout.slots.get(id))) return
      setSelections((prev) => ({ ...prev, [layout.config.id]: id }))
    },
    [layout],
  )

  const clear = useCallback(() => {
    setSelections((prev) => ({ ...prev, [layout.config.id]: null }))
  }, [layout])

  const openView = useCallback(
    (origin: Point) => {
      if (selectedId) setView({ seatId: selectedId, origin })
    },
    [selectedId],
  )

  /** Ferme la vue 3D ; `chosenId` : siège choisi depuis la vue (il peut différer de celui d'ouverture). */
  const closeView = useCallback(
    (chosenId?: string) => {
      if (!view) return
      // La vue se referme sur le siège qui reste sélectionné dans le plan
      setExitTarget(seatCenterOnPlan(chosenId ?? view.seatId))
      setView(null)
      const chosen = chosenId ? layout.slots.get(chosenId) : undefined
      if (chosen) {
        select(chosen.id)
        const message = t({
          en: `${chosen.span === 2 ? 'Double seat' : 'Seat'} ${chosen.id} selected`,
          fr: `${seatName(chosen)} ${chosen.span === 2 ? 'choisie' : 'choisi'}`,
        })
        notify((toast) =>
          toast.success(message, {
            description: t({
              en: "All that's left is to continue your order.",
              fr: 'Il ne reste plus qu’à continuer votre commande.',
            }),
          }),
        )
      }
    },
    [view, select, layout],
  )
  const backFromView = useCallback(() => closeView(), [closeView])

  const closeDetails = useCallback(() => setDetailsOpen(false), [])
  const viewOpen = view !== null

  // Le code de la scène 3D est téléchargé dès qu'un siège est sélectionné
  useEffect(() => {
    if (selectedId) preloadSeatView()
  }, [selectedId])

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion="user">
      <div className="stage" inert={viewOpen}>
        {wide && (
          // Le panneau garde sa place pendant son chargement : le téléphone ne bouge pas
          <Suspense fallback={<aside className="demo-aside" />}>
            <DemoAside layouts={layouts} activeId={layout.config.id} onChange={setRoomId} />
          </Suspense>
        )}
        <div className="device-rail">
          <div className="device">
            <div className="app">
              <div className="statusbar" aria-hidden>
                9:41
              </div>
              <DemoBar layouts={layouts} activeId={layout.config.id} onChange={setRoomId} />
              <BookingScreen
                layout={layout}
                selected={selected}
                onSelect={select}
                onClear={clear}
                onOpenView={openView}
                onPrepareView={preloadSeatView}
                onPmr={() =>
                  notify((toast) =>
                    toast.info(t({ en: 'Wheelchair space', fr: 'Emplacement PMR' }), {
                      id: 'pmr',
                      description: t({
                        en: 'To book it, ask at the theater box office.',
                        fr: 'Pour le réserver, adressez-vous à l’accueil du cinéma.',
                      }),
                    }),
                  )
                }
                onOpenDetails={() => setDetailsOpen(true)}
                onContinue={() =>
                  notify((toast) =>
                    toast.success(reservedMessage, {
                      description: t({
                        en: "Prototype: the rest of the order isn't included.",
                        fr: 'Prototype : la suite de la commande n’est pas incluse.',
                      }),
                    }),
                  )
                }
                onClose={() =>
                  notify((toast) =>
                    toast(
                      t({
                        en: 'Prototype: this button would close the booking.',
                        fr: 'Prototype : ce bouton fermerait la réservation.',
                      }),
                    ),
                  )
                }
              />
              <DetailsSheet
                open={detailsOpen}
                onClose={closeDetails}
                layout={layout}
                selected={selected}
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence custom={exitTarget}>
        {view && viewSlot && (
          <SeatView
            key="seat-view"
            layout={layout}
            slot={viewSlot}
            origin={view.origin}
            onBack={backFromView}
            onChoose={closeView}
          />
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <Toaster position="top-center" richColors />
      </Suspense>
    </MotionConfig>
    </LazyMotion>
  )
}
