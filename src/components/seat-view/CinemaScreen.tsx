import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { LANGUE } from '../../lib/langue'
import { roomScreenLogo, type RoomLayout } from '../../lib/room'

/** Adresse d'un fichier de `public/`, ou adresse complète telle quelle. */
const publicUrl = (path: string): string => (/^(https?:)?\/\//.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, ''))

/**
 * Adresse de l'image projetée (`screenImage` dans le JSON de la salle).
 * `null` sans image : l'écran est alors blanc et lumineux, comme dans la page de présentation.
 */
export function screenImageUrl(layout: RoomLayout): string | null {
  const path = layout.config.screenImage
  return path ? publicUrl(path) : null
}

/**
 * Adresse du logo projeté au centre de l'écran (`screenLogo`), dans la langue de la page : « YOUR
 * LOGO HERE » sur la démo anglaise, « VOTRE LOGO ICI » sur la française ; `null` s'il n'y en a pas.
 */
export function screenLogoUrl(layout: RoomLayout, langue: string = LANGUE): string | null {
  const path = roomScreenLogo(layout.config, langue)
  return path ? publicUrl(path) : null
}

interface CinemaScreenProps {
  layout: RoomLayout
  intro: RefObject<number>
  onReady: () => void
}

export default function CinemaScreen(props: CinemaScreenProps) {
  const image = screenImageUrl(props.layout)
  if (image) return <ImageScreen {...props} url={image} />
  const logo = screenLogoUrl(props.layout)
  return logo ? <LogoScreen {...props} url={logo} /> : <ScreenSurface {...props} />
}

/** Part de la largeur et de la hauteur de l'écran que le logo peut occuper : la même que dans le widget */
const LOGO_BOX = { width: 0.5, height: 0.44 }
/** Hauteur de l'image composée pour l'écran (px) : nette depuis le premier rang, légère pour un téléphone */
const LOGO_CANVAS_HEIGHT = 1024

/**
 * Écran blanc sur lequel un logo est projeté, centré : ce que voit le client d'un cinéma qui nous a
 * confié le sien. Le logo garde ses proportions ; l'écran reste aussi lumineux que sans lui.
 */
function LogoScreen({ url, ...props }: CinemaScreenProps & { url: string }) {
  const { width, height } = props.layout.screen
  const logo = useTexture(url)

  const texture = useMemo(() => {
    const image = logo.image as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.height = LOGO_CANVAS_HEIGHT
    canvas.width = Math.min(4096, Math.round((LOGO_CANVAS_HEIGHT * width) / height))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min((canvas.width * LOGO_BOX.width) / image.width, (canvas.height * LOGO_BOX.height) / image.height)
    const drawn = { width: image.width * scale, height: image.height * scale }
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, (canvas.width - drawn.width) / 2, (canvas.height - drawn.height) / 2, drawn.width, drawn.height)
    const composed = new THREE.CanvasTexture(canvas)
    composed.colorSpace = THREE.SRGBColorSpace
    composed.anisotropy = 8
    return composed
  }, [logo, width, height])
  useEffect(() => () => texture?.dispose(), [texture])

  return <ScreenSurface {...props} map={texture ?? undefined} bright />
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

interface ScreenSurfaceProps extends CinemaScreenProps {
  map?: THREE.Texture
  /** L'image est presque toute blanche (un logo sur écran blanc) : elle éclaire la salle comme un écran blanc */
  bright?: boolean
}

/** La toile, son cadre et la lumière qu'elle renvoie ; blanche sans `map`. */
function ScreenSurface({ layout, intro, onReady, map, bright = false }: ScreenSurfaceProps) {
  const { width, height, centerY } = layout.screen
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)

  useEffect(() => {
    onReady()
  }, [onReady])

  // Puissance lumineuse proportionnelle à la taille de l'écran ; un écran blanc éclaire
  // davantage la salle qu'une image
  const white = !map || bright
  const power = (white ? 10 : 7) * Math.sqrt((width * height) / 37)

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
        color={white ? '#eef2ff' : '#c3d3ff'}
        intensity={power}
        decay={1}
      />
    </group>
  )
}
