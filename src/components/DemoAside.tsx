import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { HOME_PATH, LOGO_URL, shareableDemoUrl } from '../lib/links'
import { qrShape } from '../lib/qr'
import type { RoomLayout } from '../lib/room'
import { RoomSwitch } from './DemoBar'
import './DemoAside.css'

interface DemoAsideProps {
  layouts: RoomLayout[]
  activeId: string
  onChange: (id: string) => void
}

/**
 * Panneau de la démo sur ordinateur, à côté du téléphone : retour à la présentation,
 * choix de la salle et QR code pour ouvrir la démo sur son propre téléphone.
 */
export default function DemoAside({ layouts, activeId, onChange }: DemoAsideProps) {
  const demoUrl = useMemo(shareableDemoUrl, [])

  return (
    <aside className="demo-aside">
      <header className="demo-aside__top">
        <a className="demo-aside__logo" href={HOME_PATH}>
          <img src={LOGO_URL} alt="VisionViewer" width={127} height={40} />
        </a>
        <a className="demo-aside__back" href={HOME_PATH}>
          <ArrowLeft aria-hidden size={15} strokeWidth={1.8} />
          Présentation
        </a>
      </header>

      <div className="demo-aside__intro">
        <span className="demo-aside__mono">Démo</span>
        <h1>Essayez-le vous-même.</h1>
        <p>
          Choisissez un fauteuil sur le plan, puis ouvrez «&nbsp;Vue 3D&nbsp;»&nbsp;: vous voyez
          l'écran depuis cette place.
        </p>
        <div className="demo-aside__room">
          <span className="demo-aside__mono" aria-hidden>
            Salle
          </span>
          <RoomSwitch id="aside" layouts={layouts} activeId={activeId} onChange={onChange} />
        </div>
      </div>

      <div className="demo-aside__phone">
        {demoUrl ? (
          <QrCode value={demoUrl} />
        ) : (
          <div className="demo-aside__qr demo-aside__qr--off demo-aside__mono">
            QR code
            <br />
            affiché sur la version en ligne
          </div>
        )}
        <div>
          <span className="demo-aside__mono">Sur votre téléphone</span>
          <h2>La démo se juge mieux en main.</h2>
          <p>
            Scannez le code&nbsp;: elle s'ouvre sur votre téléphone, là où le spectateur réservera.
          </p>
        </div>
      </div>
    </aside>
  )
}

function QrCode({ value }: { value: string }) {
  const { size, quiet, path } = useMemo(() => qrShape(value), [value])

  return (
    <svg
      className="demo-aside__qr"
      viewBox={`${-quiet} ${-quiet} ${size} ${size}`}
      role="img"
      aria-label="QR code vers la démo"
      shapeRendering="crispEdges"
    >
      <rect x={-quiet} y={-quiet} width={size} height={size} fill="#fff" />
      <path d={path} fill="#040405" />
    </svg>
  )
}
