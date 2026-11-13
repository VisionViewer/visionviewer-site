import { describe, expect, it, vi } from 'vitest'
import { layouts } from '../data/rooms'
import { isSelectable } from './room'
import { EYE_HEIGHT, eyePosition, viewMetrics } from './view'

const salle1 = layouts.find((l) => l.config.id === 'salle-1')!
const slot = (id: string) => salle1.slots.get(id)!

describe('Salle 1 (salle de la capture)', () => {
  it('a 11 rangées de 15 emplacements, A près de l’écran et K au fond', () => {
    expect(salle1.rows.map((r) => r.label).join('')).toBe('ABCDEFGHIJK')
    // 15 positions par rangée, qu'elles soient occupées par des fauteuils simples ou doubles
    expect(
      salle1.rows.every((r) => r.slots.reduce((total, s) => total + s.span, 0) === 15),
    ).toBe(true)
    expect(slot('A8').position[2]).toBeLessThan(slot('K9').position[2])
  })

  it('a des places doubles aux extrémités des rangées E et F', () => {
    for (const row of ['E', 'F']) {
      const doubles = salle1.rows
        .find((r) => r.label === row)!
        .slots.filter((s) => s.span === 2)
        .map((s) => s.id)
      expect(doubles.sort()).toEqual([`${row}1-2`, `${row}12-13`, `${row}14-15`, `${row}3-4`])
    }
    expect(salle1.doubleCount).toBe(8)
    expect(salle1.seatCount).toBe(157) // la capacité ne change pas
  })

  it('reproduit la rangée K : fauteuils, PMR et vides', () => {
    const kinds = (kind: string) =>
      salle1.rows
        .at(-1)!
        .slots.filter((s) => s.kind === kind)
        .map((s) => s.number)
    expect(kinds('seat')).toEqual([1, 4, 5, 9, 10, 14, 15])
    expect(kinds('pmr')).toEqual([2, 6, 8, 11, 13])
    expect(kinds('empty')).toEqual([3, 7, 12])
  })

  it('marque I7 et I8 occupés, donc non sélectionnables', () => {
    expect(slot('I7').occupied).toBe(true)
    expect(slot('I8').occupied).toBe(true)
    expect(isSelectable(slot('I7'))).toBe(false)
    expect(isSelectable(slot('K2'))).toBe(false) // PMR
    expect(isSelectable(slot('G9'))).toBe(true)
  })

  it('place la caméra de A1 près de l’écran, celle de K15 loin, de part et d’autre de l’axe', () => {
    const a1 = eyePosition(slot('A1'))
    const k15 = eyePosition(slot('K15'))
    // A1 est à gauche du plan (écran en bas), donc à droite du spectateur : l'écran s'étend à sa gauche
    expect(a1[0]).toBeGreaterThan(0)
    expect(k15[0]).toBeLessThan(0)
    expect(a1[0]).toBeCloseTo(-k15[0])
    expect(a1[2]).toBeCloseTo(salle1.config.dimensions.screenToFirstRow)
    expect(k15[2]).toBeGreaterThan(a1[2] + 10)
    expect(a1[1]).toBeCloseTo(EYE_HEIGHT) // premier rang : au niveau du sol
    expect(k15[1]).toBeGreaterThan(a1[1]) // gradin
  })

  it('traite le plan comme une vue de dessus, écran en bas : gauche du plan = droite du spectateur', () => {
    expect(slot('A1').planX).toBeLessThan(slot('A15').planX)
    expect(slot('A1').position[0]).toBeGreaterThan(slot('A15').position[0])
  })

  it('calcule distance et angle de vision', () => {
    const centre = viewMetrics(salle1, slot('G8'))
    const devant = viewMetrics(salle1, slot('A8'))
    const fond = viewMetrics(salle1, slot('K9'))
    expect(devant.distance).toBeLessThan(centre.distance)
    expect(devant.horizontalAngle).toBeGreaterThan(centre.horizontalAngle)
    expect(fond.horizontalAngle).toBeLessThan(centre.horizontalAngle)
    // G8 est dans l'axe : angle = 2·atan(demi-largeur / distance au plan de l'écran)
    const { screenWidth } = salle1.config.dimensions
    const expected = (2 * Math.atan(screenWidth / 2 / slot('G8').position[2]) * 180) / Math.PI
    expect(centre.horizontalAngle).toBeCloseTo(expected)
  })
})

describe('Places doubles (grande salle)', () => {
  const grande = layouts.find((l) => l.config.id === 'grande-salle')!
  const double = grande.slots.get('R1-2')!

  it('fusionne deux positions en une place double', () => {
    expect(double.span).toBe(2)
    expect(grande.slots.has('R1')).toBe(false)
    expect(grande.slots.has('R2')).toBe(false)
    expect(grande.doubleCount).toBe(6)
    // Une place double compte pour deux : la capacité de la salle ne change pas
    expect(grande.seatCount).toBe(18 * 24 - 4 - 4)
  })

  it('la place au centre de ses deux positions, sur le plan comme en 3D', () => {
    const next = grande.slots.get('R3-4')!
    const { seatWidth } = grande.config.dimensions
    expect(next.planX - double.planX).toBeCloseTo(2)
    expect(double.position[0] - next.position[0]).toBeCloseTo(2 * seatWidth)
    // Bord du bloc de sièges : le centre de la banquette est à une largeur de fauteuil du bord
    expect(double.position[0]).toBeCloseTo(grande.seating.width / 2 - seatWidth)
  })

  it('reste sélectionnable, sauf si elle est occupée', () => {
    expect(isSelectable(double)).toBe(true)
    expect(grande.slots.get('R21-22')!.occupied).toBe(true)
    expect(isSelectable(grande.slots.get('R21-22'))).toBe(false)
  })

  it('ignore une place double mal placée (à cheval sur une allée, sur un PMR)', async () => {
    const { buildLayout } = await import('./room')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const room = buildLayout({
      ...grande.config,
      id: 'test-doubles',
      occupied: [],
      preselected: undefined,
      rowOverrides: { A: { pmr: [1], double: [1, 6, 10, 11] } },
    })
    warn.mockRestore()
    expect(room.slots.has('A1-2')).toBe(false) // recouvre un PMR
    expect(room.slots.has('A6-7')).toBe(false) // à cheval sur l'allée après le 6
    expect(room.slots.has('A10-11')).toBe(true)
    expect(room.slots.has('A11-12')).toBe(false) // chevauche la précédente
    expect(room.doubleCount).toBe(1)
  })

  it('passe par-dessus les places doubles dans la navigation entre sièges', async () => {
    const { neighborSeat } = await import('./room')
    // R5-6 est contre l'allée ; son voisin vers la droite du spectateur est R3-4
    expect(neighborSeat(grande, grande.slots.get('R5-6')!, 'right')?.id).toBe('R3-4')
    // Depuis Q5, la rangée de derrière mène à la banquette la mieux alignée
    expect(neighborSeat(grande, grande.slots.get('Q5')!, 'back')?.id).toBe('R5-6')
  })
})

describe('Toutes les salles', () => {
  it('ont un identifiant unique et un siège présélectionné valide', () => {
    expect(new Set(layouts.map((l) => l.config.id)).size).toBe(layouts.length)
    for (const layout of layouts) {
      const pre = layout.config.preselected
      if (pre) expect(isSelectable(layout.slots.get(pre))).toBe(true)
      for (const id of layout.config.occupied ?? []) {
        expect(layout.slots.get(id)?.kind, `${layout.config.id} : ${id}`).toBe('seat')
      }
    }
  })

  it('inverse la numérotation avec seatOneSide = "right"', async () => {
    const { buildLayout } = await import('./room')
    const mirrored = buildLayout({ ...salle1.config, id: 'miroir', seatOneSide: 'right' })
    // Le n°1 passe à droite du plan, donc à gauche du spectateur
    expect(mirrored.slots.get('A1')!.planX).toBeGreaterThan(mirrored.slots.get('A15')!.planX)
    expect(mirrored.slots.get('A1')!.position[0]).toBeLessThan(0)
  })
})
