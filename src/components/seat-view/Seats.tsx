import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoomLayout, Slot } from '../../lib/room'
import { createSeatGeometry, createSpectatorGeometry, hash01 } from './geometry'

const VELVET = '#8a1c2b'
const SELECTED = '#18a558'
const SPECTATOR = '#14161f'

interface SeatsProps {
  layout: RoomLayout
  selectedId: string
}

/** Tous les fauteuils de la salle : un InstancedMesh pour les simples, un pour les places doubles. */
export function Seats({ layout, selectedId }: SeatsProps) {
  const seatWidth = layout.config.dimensions.seatWidth
  const { singles, doubles } = useMemo(() => {
    const seats = [...layout.slots.values()].filter((slot) => slot.kind === 'seat')
    return {
      singles: seats.filter((seat) => seat.span === 1),
      doubles: seats.filter((seat) => seat.span === 2),
    }
  }, [layout])

  return (
    <>
      <SeatInstances seats={singles} seatWidth={seatWidth} span={1} selectedId={selectedId} />
      <SeatInstances seats={doubles} seatWidth={seatWidth} span={2} selectedId={selectedId} />
    </>
  )
}

function SeatInstances({
  seats,
  seatWidth,
  span,
  selectedId,
}: {
  seats: Slot[]
  seatWidth: number
  span: 1 | 2
  selectedId: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => createSeatGeometry(seatWidth, span), [seatWidth, span])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    seats.forEach((seat, i) => {
      matrix.makeTranslation(seat.position[0], seat.position[1], seat.position[2])
      mesh.setMatrixAt(i, matrix)
      if (seat.id === selectedId) color.set(SELECTED)
      else color.set(VELVET).offsetHSL(0, 0, (hash01(seat.id) - 0.5) * 0.03)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats, selectedId])

  if (seats.length === 0) return null
  return (
    <instancedMesh ref={ref} key={seats.length} args={[geometry, undefined, seats.length]}>
      <meshStandardMaterial roughness={0.85} metalness={0} />
    </instancedMesh>
  )
}

/** Silhouettes des spectateurs sur les sièges occupés (deux sur une place double). */
export function Spectators({ layout }: { layout: RoomLayout }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const seatWidth = layout.config.dimensions.seatWidth

  const people = useMemo(
    () =>
      [...layout.slots.values()]
        .filter((slot) => slot.occupied)
        .flatMap((seat) =>
          (seat.span === 2 ? [-seatWidth / 2, seatWidth / 2] : [0]).map((offset, i) => ({
            key: `${seat.id}/${i}`,
            x: seat.position[0] + offset,
            y: seat.position[1],
            z: seat.position[2],
          })),
        ),
    [layout, seatWidth],
  )
  const geometry = useMemo(() => createSpectatorGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    people.forEach((person, i) => {
      // Tailles et postures légèrement différentes d'un spectateur à l'autre
      const r = hash01(person.key)
      position.set(person.x + (r - 0.5) * 0.06, person.y, person.z)
      rotation.setFromAxisAngle(up, (hash01(person.key + '*') - 0.5) * 0.35)
      scale.set(1, 0.94 + r * 0.1, 1)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [people])

  if (people.length === 0) return null
  return (
    <instancedMesh ref={ref} key={people.length} args={[geometry, undefined, people.length]}>
      <meshStandardMaterial color={SPECTATOR} roughness={1} />
    </instancedMesh>
  )
}

/** Anneau lumineux au-dessus du siège choisi, visible pendant le survol d'introduction. */
export function SeatBeacon({ slot, intro }: { slot: Slot; intro: RefObject<number> }) {
  const ring = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const time = useRef(0)

  useFrame((_, delta) => {
    time.current += delta
    const fade = 1 - THREE.MathUtils.smoothstep(intro.current, 0.3, 0.6)
    if (material.current) material.current.opacity = fade
    if (ring.current) {
      ring.current.visible = fade > 0.01
      ring.current.scale.setScalar(1 + 0.18 * Math.sin(time.current * 5))
      ring.current.position.y = slot.position[1] + 1.75 + 0.08 * Math.sin(time.current * 2.5)
    }
  })

  return (
    <mesh
      ref={ring}
      position={[slot.position[0], slot.position[1] + 1.75, slot.position[2]]}
      rotation-x={-Math.PI / 2}
    >
      <ringGeometry args={[0.3, 0.38, 48]} />
      <meshBasicMaterial
        ref={material}
        color={[0.25, 2.2, 0.9]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
