import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import type { RoomLayout, Slot } from '../../lib/room'
import { eyePosition, overviewPosition, screenCenter } from '../../lib/view'
import Auditorium from './Auditorium'
import CinemaScreen from './CinemaScreen'
import HeadCamera from './HeadCamera'
import { SeatBeacon, Seats, Spectators } from './Seats'

export interface SceneProps {
  layout: RoomLayout
  /** Siège depuis lequel on regarde (peut changer : la caméra glisse jusqu'au nouveau) */
  slot: Slot
  /** Siège d'ouverture : cible du survol d'introduction */
  introSlot: Slot
  skipIntro: boolean
  recenterSignal: number
  /** L'image de l'écran est chargée, la scène est affichable */
  onReady: () => void
  /** La caméra est arrivée au siège */
  onArrive: () => void
  /** L'utilisateur a tourné la tête */
  onLook: () => void
}

export default function Scene({
  layout,
  slot,
  introSlot,
  skipIntro,
  recenterSignal,
  onReady,
  onArrive,
  onLook,
}: SceneProps) {
  const intro = useRef(0)
  const [ready, setReady] = useState(false)
  // Effets (halo, vignette) coupés automatiquement si l'appareil peine
  const [effects, setEffects] = useState(true)

  const eye = useMemo(() => eyePosition(slot), [slot])
  const target = useMemo(() => screenCenter(layout), [layout])
  const overview = useMemo(() => overviewPosition(layout, introSlot), [layout, introSlot])

  const handleReady = useCallback(() => {
    setReady(true)
    onReady()
  }, [onReady])

  return (
    <Canvas
      flat
      dpr={effects ? [1, 1.75] : 1}
      camera={{ fov: 70, near: 0.1, far: 300, position: overview as [number, number, number] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#040406']} />
      <PerformanceMonitor onDecline={() => setEffects(false)} />

      <Auditorium layout={layout} intro={intro} />
      <Seats layout={layout} selectedId={slot.id} />
      <Spectators layout={layout} />
      <SeatBeacon slot={introSlot} intro={intro} />
      <Suspense fallback={null}>
        <CinemaScreen layout={layout} intro={intro} onReady={handleReady} />
      </Suspense>

      <HeadCamera
        seatId={slot.id}
        eye={eye}
        target={target}
        overview={overview}
        ready={ready}
        skipIntro={skipIntro}
        intro={intro}
        recenterSignal={recenterSignal}
        onArrive={onArrive}
        onLook={onLook}
      />

      {effects && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.6} luminanceSmoothing={0.25} />
          <Vignette offset={0.28} darkness={0.72} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
