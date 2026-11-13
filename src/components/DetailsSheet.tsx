import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import type { RoomLayout, Slot } from '../lib/room'
import { formatEuro } from '../lib/format'
import './DetailsSheet.css'

interface DetailsSheetProps {
  open: boolean
  onClose: () => void
  layout: RoomLayout
  selected: Slot | undefined
}

/** Feuille « Détails » : glisser vers le bas, toucher le fond ou Échap pour fermer. */
export default function DetailsSheet({ open, onClose, layout, selected }: DetailsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  // Une place double se vend par deux
  const places = selected?.span ?? 1
  const total = layout.config.price * places

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <m.div
            key="sheet"
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="sheet__handle" aria-hidden />
            <h2 id="sheet-title" className="sheet__title">
              Détails de la commande
            </h2>
            <dl className="sheet__list">
              <div>
                <dt>Salle</dt>
                <dd>{layout.config.name}</dd>
              </div>
              <div>
                <dt>Fauteuil</dt>
                <dd>
                  {!selected
                    ? 'Aucun'
                    : selected.span === 2
                      ? `Rangée ${selected.row} · n° ${selected.number} et ${selected.number + 1} (double)`
                      : `Rangée ${selected.row} · n° ${selected.number}`}
                </dd>
              </div>
              <div>
                <dt>{places === 2 ? `2 places × ${formatEuro(layout.config.price)}` : '1 place'}</dt>
                <dd>{formatEuro(total)}</dd>
              </div>
              <div className="sheet__total">
                <dt>Total à régler</dt>
                <dd>{formatEuro(total)}</dd>
              </div>
            </dl>
            <button ref={closeRef} type="button" className="sheet__close" onClick={onClose}>
              Fermer
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
