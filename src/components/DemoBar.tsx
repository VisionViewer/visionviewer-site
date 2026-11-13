import * as m from 'motion/react-m'
import { ArrowLeft } from 'lucide-react'
import { HOME_PATH, LOGO_URL } from '../lib/links'
import type { RoomLayout } from '../lib/room'
import './DemoBar.css'

interface RoomSwitchProps {
  /** Distingue les sélecteurs présents en même temps dans la page, pour l'animation */
  id: string
  layouts: RoomLayout[]
  activeId: string
  onChange: (id: string) => void
}

/** Sélecteur de salle — hors maquette, uniquement pour la démo. */
export function RoomSwitch({ id, layouts, activeId, onChange }: RoomSwitchProps) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Salle de démonstration">
      {layouts.map((layout) => {
        const active = layout.config.id === activeId
        return (
          <button
            key={layout.config.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`segmented__item${active ? ' is-active' : ''}`}
            onClick={() => onChange(layout.config.id)}
          >
            {active && (
              <m.span
                layoutId={`segmented-pill-${id}`}
                className="segmented__pill"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
              />
            )}
            <span className="segmented__label">{layout.config.name}</span>
            <span className="segmented__meta">{layout.seatCount}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Bandeau de démo affiché sur mobile, au-dessus de l'écran de réservation. */
export default function DemoBar(switchProps: Omit<RoomSwitchProps, 'id'>) {
  return (
    <div className="demo-bar">
      <a className="demo-bar__about" href={HOME_PATH}>
        <ArrowLeft aria-hidden size={16} strokeWidth={2} />
        <img src={LOGO_URL} alt="VisionViewer" width={86} height={27} />
        <span className="visually-hidden"> : retour à la présentation</span>
      </a>
      <RoomSwitch id="bar" {...switchProps} />
    </div>
  )
}
