import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomLayout } from '../../lib/room'

/**
 * Adresse de l'image projetée (`screenImage` dans le JSON de la salle).
 * `null` sans image : l'écran est alors blanc et lumineux, comme dans la page de présentation.
 */
export function screenImageUrl(layout: RoomLayout): string | null {
  const path = layout.config.screenImage
  if (!path) return null
  return /^(https?:)?\/\//.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, '')
}

interface CinemaScreenProps {
  layout: RoomLayout
  intro: RefObject<number>
  onReady: () => void
}

export default function CinemaScreen(props: CinemaScreenProps) {
  const url = screenImageUrl(props.layout)
  return url ? <ImageScreen {...props} url={url} /> : <ScreenSurface {...props} />
}

/** Écran sur lequel une image est projetée. */
function ImageScreen({ url, ...props }: CinemaScreenProps & { url: string }) {
  const { width, height } = props.layout.screen
  const texture = useTexture(url)

  // L'image remplit l'écran sans déformation (recadrage centré si les formats diffèrent)
  useLayoutEffect(() => {
    const image = texture.image as { width: number; height: number }
    const ratio = image.width / image.height / (width / height)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    if (ratio > 1) {
      texture.repeat.set(1 / ratio, 1)
      texture.offset.set((1 - 1 / ratio) / 2, 0)
    } else {
      texture.repeat.set(1, ratio)
      texture.offset.set(0, (1 - ratio) / 2)
    }
    texture.needsUpdate = true
  }, [texture, width, height])

  return <ScreenSurface {...props} map={texture} />
}

/** La toile, son cadre et la lumière qu'elle renvoie ; blanche sans `map`. */
function ScreenSurface({ layout, intro, onReady, map }: CinemaScreenProps & { map?: THREE.Texture }) {
  const { width, height, centerY } = layout.screen
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)

  useEffect(() => {
    onReady()
  }, [onReady])

  // Puissance lumineuse proportionnelle à la taille de l'écran ; un écran blanc éclaire
  // davantage la salle qu'une image
  const power = (map ? 7 : 10) * Math.sqrt((width * height) / 37)

  useFrame(() => {
    // L'écran s'allume pendant que la salle s'éteint
    const on = THREE.MathUtils.smoothstep(intro.current, 0.35, 1)
    material.current?.color.setScalar(0.05 + 0.95 * on)
    if (light.current) light.current.intensity = power * (0.1 + 0.9 * on)
  })

  return (
    <group position={[0, centerY, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={material} map={map ?? null} toneMapped={false} />
      </mesh>
      {/* Cadre noir autour de l'image */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.1]} />
        <meshBasicMaterial color="#020203" />
      </mesh>
      {/* La lumière renvoyée par l'écran vers la salle */}
      <pointLight
        ref={light}
        position={[0, 0, 1.5]}
        color={map ? '#c3d3ff' : '#eef2ff'}
        intensity={power}
        decay={1}
      />
    </group>
  )
}
