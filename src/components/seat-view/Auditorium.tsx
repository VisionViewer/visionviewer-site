import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FOOTWELL, FRONT_WALL_Z, type RoomLayout } from '../../lib/room'
import { createSlatTexture } from './geometry'

interface AuditoriumProps {
  layout: RoomLayout
  /** Avancement du survol d'introduction (0 → 1) : la salle s'éteint à l'arrivée */
  intro: RefObject<number>
}


interface Box {
  position: [number, number, number]
  scale: [number, number, number]
}

export default function Auditorium({ layout, intro }: AuditoriumProps) {
  const { shell, config, aisles } = layout
  const d = config.dimensions
  const rowCount = config.rows.length
  const { width: W, depth: D, height: H } = shell
  const length = D - FRONT_WALL_Z
  const midZ = (D + FRONT_WALL_Z) / 2

  const hemisphere = useRef<THREE.HemisphereLight>(null)
  const rearFill = useRef<THREE.PointLight>(null)
  const sconceMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const downlightMaterial = useRef<THREE.MeshBasicMaterial>(null)

  // Gradins : un pavé plein par rangée (la première est au niveau du sol)
  const tiers = useMemo<Box[]>(() => {
    const boxes: Box[] = []
    for (let i = 1; i < rowCount; i++) {
      const front = d.screenToFirstRow + i * d.rowSpacing - FOOTWELL
      const back = i === rowCount - 1 ? D : front + d.rowSpacing
      const top = i * d.stepHeight
      boxes.push({
        position: [0, top / 2, (front + back) / 2],
        scale: [W, top, back - front],
      })
    }
    return boxes
  }, [rowCount, d, W, D])

  // Balisage lumineux au nez de chaque marche, dans les allées
  const stepLights = useMemo<Box[]>(() => {
    const boxes: Box[] = []
    for (let i = 1; i < rowCount; i++) {
      const front = d.screenToFirstRow + i * d.rowSpacing - FOOTWELL
      for (const aisle of aisles) {
        boxes.push({
          position: [aisle.x, i * d.stepHeight + 0.006, front + 0.035],
          scale: [Math.max(0.2, aisle.width - 0.3), 0.012, 0.03],
        })
      }
    }
    return boxes
  }, [rowCount, d, aisles])

  // Appliques murales, qui suivent la pente du gradin
  const sconces = useMemo<Box[]>(() => {
    const boxes: Box[] = []
    const count = Math.max(2, Math.round(D / 3.2))
    for (let i = 0; i < count; i++) {
      const z = ((i + 0.5) / count) * D
      const row = Math.max(0, Math.min(rowCount - 1, (z - d.screenToFirstRow) / d.rowSpacing))
      const y = Math.min(H - 0.6, row * d.stepHeight + 2.25)
      for (const side of [-1, 1]) {
        boxes.push({ position: [side * (W / 2 - 0.04), y, z], scale: [0.06, 0.55, 0.16] })
      }
    }
    return boxes
  }, [D, H, W, rowCount, d])

  // Spots encastrés au plafond : ils donnent la profondeur de la salle une fois tamisés
  const downlights = useMemo<Box[]>(() => {
    const boxes: Box[] = []
    const columns = Math.max(2, Math.round(W / 4))
    const lines = Math.max(2, Math.round(D / 2.6))
    for (let line = 0; line < lines; line++) {
      const z = 1.2 + ((line + 0.5) / lines) * (D - 1.6)
      for (let column = 0; column < columns; column++) {
        const x = ((column + 0.5) / columns - 0.5) * W
        boxes.push({ position: [x, H - 0.01, z], scale: [1, 1, 1] })
      }
    }
    return boxes
  }, [W, D, H])

  const downlightGeometry = useMemo(
    () => new THREE.CircleGeometry(0.07, 20).rotateX(Math.PI / 2),
    [],
  )
  useEffect(() => () => downlightGeometry.dispose(), [downlightGeometry])

  const slats = useMemo(() => {
    const side = createSlatTexture()
    side.repeat.set(Math.round(length / 0.45), 1)
    const back = createSlatTexture()
    back.repeat.set(Math.round(W / 0.45), 1)
    return { side, back }
  }, [length, W])

  useEffect(
    () => () => {
      slats.side.dispose()
      slats.back.dispose()
    },
    [slats],
  )

  useFrame(() => {
    // Lumières de salle : pleines pendant le survol, tamisées une fois assis
    const t = intro.current
    const house = 1 - THREE.MathUtils.smoothstep(t, 0.3, 0.95)
    if (hemisphere.current) hemisphere.current.intensity = 0.5 + 1.7 * house
    if (rearFill.current) rearFill.current.intensity = 2.2 + 6 * house
    sconceMaterial.current?.color.setRGB(1.5, 0.82, 0.42).multiplyScalar(0.35 + 0.9 * house)
    downlightMaterial.current?.color.setRGB(1.6, 1.35, 1.05).multiplyScalar(0.3 + 1.0 * house)
  })

  return (
    <group>
      <hemisphereLight ref={hemisphere} args={['#7f8fd0', '#231820', 2.2]} />
      {/* Éclairage d'ambiance venant du fond de salle : dessine le dos des fauteuils */}
      <pointLight
        ref={rearFill}
        position={[0, H - 0.4, D - 0.8]}
        color="#ffc998"
        intensity={8}
        decay={1}
      />

      {/* Sol */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, midZ]}>
        <planeGeometry args={[W, length]} />
        <meshStandardMaterial color="#1b1820" roughness={1} />
      </mesh>
      <InstancedBoxes boxes={tiers}>
        <meshStandardMaterial color="#1b1820" roughness={1} />
      </InstancedBoxes>

      {/* Plafond */}
      <mesh rotation-x={Math.PI / 2} position={[0, H, midZ]}>
        <planeGeometry args={[W, length]} />
        <meshStandardMaterial color="#1a1921" roughness={1} />
      </mesh>
      <InstancedBoxes boxes={downlights} geometry={downlightGeometry}>
        <meshBasicMaterial ref={downlightMaterial} color={[1.6, 1.35, 1.05]} toneMapped={false} />
      </InstancedBoxes>

      {/* Murs latéraux (visibles uniquement de l'intérieur) */}
      <mesh rotation-y={Math.PI / 2} position={[-W / 2, H / 2, midZ]}>
        <planeGeometry args={[length, H]} />
        <meshStandardMaterial color="#2a2036" roughness={1} map={slats.side} />
      </mesh>
      <mesh rotation-y={-Math.PI / 2} position={[W / 2, H / 2, midZ]}>
        <planeGeometry args={[length, H]} />
        <meshStandardMaterial color="#2a2036" roughness={1} map={slats.side} />
      </mesh>

      {/* Mur du fond */}
      <mesh rotation-y={Math.PI} position={[0, H / 2, D]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#241b2e" roughness={1} map={slats.back} />
      </mesh>

      {/* Mur d'écran */}
      <mesh position={[0, H / 2, FRONT_WALL_Z]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#09090c" roughness={1} />
      </mesh>

      <InstancedBoxes boxes={stepLights}>
        <meshBasicMaterial color={[1.6, 1.05, 0.5]} toneMapped={false} />
      </InstancedBoxes>
      <InstancedBoxes boxes={sconces}>
        <meshBasicMaterial ref={sconceMaterial} color={[1.5, 0.82, 0.42]} toneMapped={false} />
      </InstancedBoxes>
    </group>
  )
}

/** Dessine une liste de pavés (ou d'une autre géométrie) en un seul appel de rendu. */
function InstancedBoxes({
  boxes,
  geometry,
  children,
}: {
  boxes: Box[]
  geometry?: THREE.BufferGeometry
  children: ReactNode
}) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    boxes.forEach((box, i) => {
      matrix.compose(position.set(...box.position), rotation, scale.set(...box.scale))
      mesh.setMatrixAt(i, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes])

  if (boxes.length === 0) return null
  return (
    <instancedMesh ref={ref} key={boxes.length} args={[geometry, undefined, boxes.length]}>
      {!geometry && <boxGeometry />}
      {children}
    </instancedMesh>
  )
}
