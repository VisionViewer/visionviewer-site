import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { roomTexts, type RoomLayout, type Slot } from '../lib/room'
import { formatEuro } from '../lib/format'
import { LANGUE, t } from '../lib/langue'
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
              {t({ en: 'Order details', fr: 'Détails de la commande' })}
            </h2>
            <dl className="sheet__list">
              <div>
                <dt>{t({ en: 'Auditorium', fr: 'Salle' })}</dt>
                <dd>{roomTexts(layout.config, LANGUE).name}</dd>
              </div>
              <div>
                <dt>{t({ en: 'Seat', fr: 'Fauteuil' })}</dt>
                <dd>
                  {!selected
                    ? t({ en: 'None', fr: 'Aucun' })
                    : selected.span === 2
                      ? t({
                          en: `Row ${selected.row} · nos. ${selected.number} and ${selected.number + 1} (double)`,
                          fr: `Rangée ${selected.row} · n° ${selected.number} et ${selected.number + 1} (double)`,
                        })
                      : t({
                          en: `Row ${selected.row} · no. ${selected.number}`,
                          fr: `Rangée ${selected.row} · n° ${selected.number}`,
                        })}
                </dd>
              </div>
              <div>
                <dt>
                  {places === 2
                    ? t({
                        en: `2 seats × ${formatEuro(layout.config.price)}`,
                        fr: `2 places × ${formatEuro(layout.config.price)}`,
                      })
                    : t({ en: '1 seat', fr: '1 place' })}
                </dt>
                <dd>{formatEuro(total)}</dd>
              </div>
              <div className="sheet__total">
                <dt>{t({ en: 'Total due', fr: 'Total à régler' })}</dt>
                <dd>{formatEuro(total)}</dd>
              </div>
            </dl>
            <button ref={closeRef} type="button" className="sheet__close" onClick={onClose}>
              {t({ en: 'Close', fr: 'Fermer' })}
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
