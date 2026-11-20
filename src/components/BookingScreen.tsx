import { useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { Accessibility, ChevronUp, Eye, Info, X } from 'lucide-react'
import type { RoomLayout, Slot } from '../lib/room'
import { formatEuro } from '../lib/format'
import { t } from '../lib/langue'
import SeatPlan from './SeatPlan'
import './BookingScreen.css'

export interface Point {
  x: number
  y: number
}

interface BookingScreenProps {
  layout: RoomLayout
  selected: Slot | undefined
  onSelect: (id: string) => void
  onClear: () => void
  /** `origin` : centre du bouton, point de départ de la transition vers la vue 3D */
  onOpenView: (origin: Point) => void
  onPrepareView?: () => void
  onPmr: () => void
  onOpenDetails: () => void
  onContinue: () => void
  onClose: () => void
}

const spring = { type: 'spring', stiffness: 420, damping: 36 } as const

export default function BookingScreen({
  layout,
  selected,
  onSelect,
  onClear,
  onOpenView,
  onPrepareView,
  onPmr,
  onOpenDetails,
  onContinue,
  onClose,
}: BookingScreenProps) {
  const roomId = layout.config.id
  // Une place double se vend par deux
  const places = selected?.span ?? 1

  // Pastille « Nouveau » sur le bouton de vue 3D, jusqu'à la première ouverture
  const [fresh, setFresh] = useState(true)

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">{t({ en: 'My booking', fr: 'Ma réservation' })}</h1>
        <button
          type="button"
          className="topbar__close"
          aria-label={t({ en: 'Close', fr: 'Fermer' })}
          onClick={onClose}
        >
          <X aria-hidden size={26} strokeWidth={2.2} />
        </button>
      </header>

      <main className="content">
        <Reveal order={0}>
          <h2 className="title">{t({ en: 'Select your seats', fr: 'Sélectionner vos fauteuils' })}</h2>
        </Reveal>

        <Reveal order={1}>
          <div className="selection">
            <p className="selection__text">
              {t({
                en: `${selected?.span === 2 ? 'Double seat selected' : 'Seat selected'} (${selected?.span ?? 0} of ${selected?.span ?? 1}):`,
                fr: `${selected?.span === 2 ? 'Place double sélectionnée' : 'Fauteuil sélectionné'} (${selected?.span ?? 0} sur ${selected?.span ?? 1}) :`,
              })}{' '}
              <span className="selection__seat">
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.strong
                    key={`${roomId}-${selected?.id ?? 'none'}`}
                    className={selected ? undefined : 'is-empty'}
                    initial={{ y: 14, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -14, opacity: 0, filter: 'blur(4px)' }}
                    transition={spring}
                  >
                    {selected?.id ?? '—'}
                  </m.strong>
                </AnimatePresence>
              </span>
            </p>
            <button
              type="button"
              className="link-button"
              onClick={onClear}
              disabled={!selected}
            >
              {t({ en: 'Clear', fr: 'Effacer' })}
            </button>
          </div>
        </Reveal>

        <Reveal order={2}>
          <p className="info">
            <Info aria-hidden size={16} strokeWidth={2.2} />
            <span>
              {t({
                en: 'Spaces marked with the',
                fr: 'Les emplacements signalés par le pictogramme',
              })}{' '}
              <Accessibility
                aria-label={t({ en: 'wheelchair', fr: 'PMR' })}
                size={14}
                strokeWidth={2.4}
                className="info__picto"
              />{' '}
              {t({
                en: 'symbol are reserved for guests with limited mobility. To book one, ask at the theater box office.',
                fr: "sont réservés aux personnes à mobilité réduite. Pour en réserver un, adressez-vous à l'accueil du cinéma.",
              })}
            </span>
          </p>
        </Reveal>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={roomId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <SeatPlan
              layout={layout}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              onPmr={onPmr}
            />
          </m.div>
        </AnimatePresence>

        <Reveal order={3}>
          <ul className="legend" aria-label={t({ en: 'Legend', fr: 'Légende' })}>
            <li>
              <span className="legend__chip legend__chip--free" aria-hidden />
              {t({ en: 'Available', fr: 'Libre' })}
            </li>
            <li>
              <span className="legend__chip legend__chip--selected" aria-hidden />
              {t({ en: 'Selected', fr: 'Sélectionné' })}
            </li>
            <li>
              <span className="legend__chip legend__chip--occupied" aria-hidden />
              {t({ en: 'Taken', fr: 'Occupé' })}
            </li>
            <li>
              <span className="legend__chip legend__chip--pmr" aria-hidden>
                <Accessibility />
              </span>
              {t({ en: 'Wheelchair', fr: 'PMR' })}
            </li>
            {layout.doubleCount > 0 && (
              <li>
                <span className="legend__chip legend__chip--double" aria-hidden />
                {t({ en: 'Double seat', fr: 'Place double' })}
              </li>
            )}
          </ul>
        </Reveal>
      </main>

      <footer className="bottombar">
        <div className="bottombar__row">
          <p className="bottombar__total">
            {t({ en: 'Total due:', fr: 'Total à régler :' })}{' '}
            <strong>{formatEuro(layout.config.price * places)}</strong>
          </p>
          <button type="button" className="link-button" onClick={onOpenDetails}>
            {t({ en: 'Details', fr: 'Détails' })}
            <ChevronUp aria-hidden size={16} strokeWidth={2.6} />
          </button>
        </div>

        <div className="bottombar__actions">
          <m.button
            type="button"
            className="view-btn"
            aria-label={t({
              en: '3D view: see the view from this seat',
              fr: 'Vue 3D : voir la vue depuis ce siège',
            })}
            whileTap={{ scale: 0.95 }}
            disabled={!selected}
            onPointerEnter={onPrepareView}
            onFocus={onPrepareView}
            onClick={(e) => {
              setFresh(false)
              const rect = e.currentTarget.getBoundingClientRect()
              onOpenView({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
            }}
          >
            {/* Rejoué à chaque nouveau siège : relie la sélection au bouton */}
            {selected && <span key={selected.id} className="view-btn__pulse" aria-hidden />}
            <Eye aria-hidden size={22} strokeWidth={2.2} />
            <span className="view-btn__label">{t({ en: '3D view', fr: 'Vue 3D' })}</span>
            {fresh && (
              <span className="view-btn__badge" aria-hidden>
                {t({ en: 'New', fr: 'Nouveau' })}
              </span>
            )}
          </m.button>

          <m.button
            type="button"
            className="cta"
            whileTap={{ scale: 0.98 }}
            disabled={!selected}
            onClick={onContinue}
          >
            {t({ en: 'Continue my order', fr: 'Continuer ma commande' })}
          </m.button>
        </div>
      </footer>
    </>
  )
}

function Reveal({ order, children }: { order: number; children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + order * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  )
}
