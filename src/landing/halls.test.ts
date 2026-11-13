import { describe, expect, it } from 'vitest'
import page from '../../index.html?raw'
import { layouts } from '../data/rooms'
import { coupeCaption } from './coupe'
import { fr, halls, screenSize } from './halls'

const text = page.replace(/&nbsp;/g, ' ')
const salle = halls[0]

describe('Salles de la page de présentation', () => {
  it('sont celles de la démo, avec les mêmes fauteuils et les mêmes spectateurs', () => {
    expect(halls.map((h) => h.name)).toEqual(layouts.map((l) => l.config.name))
    halls.forEach((hall, i) => {
      const layout = layouts[i]
      expect(hall.places).toBe(layout.seatCount)
      const busy = hall.seats.filter((s) => s.busy).map((s) => s.id)
      expect(busy.sort()).toEqual([...(layout.config.occupied ?? [])].sort())
      for (const seat of hall.seats) {
        expect([seat.x, seat.y, seat.z]).toEqual([...layout.slots.get(seat.id)!.position])
      }
    })
  })

  it('regarde l’écran depuis des fauteuils simples et libres', () => {
    for (const hall of halls) {
      for (const id of [hall.selected, hall.front, hall.back]) {
        const seat = hall.seats.find((s) => s.id === id)!
        expect(seat, `${hall.name} : ${id}`).toMatchObject({ span: 1, busy: false, pmr: false })
      }
    }
    expect([salle.selected, salle.front, salle.back]).toEqual(['G9', 'A1', 'K15'])
  })
})

// Le texte de index.html est écrit à la main : ces tests signalent un chiffre resté en arrière
// quand le JSON de la première salle change.
describe('Texte de la page de présentation', () => {
  it('cite les chiffres de la première salle de la démo', () => {
    const d = salle.dim
    const rows = salle.rows.length
    expect(text).toContain(`${salle.name}. Onze rangs, ${salle.places} places.`)
    expect(rows).toBe(11)
    expect(text).toContain(
      `Écran de ${screenSize(salle)}, pente de ${fr(salle.slope)}°, ${fr(d.rowGap, 2)} m entre les rangs, ${salle.pmrCount} emplacements PMR.`,
    )
    expect(text).toContain(`<dd id="sPlaces">${salle.places}</dd>`)
    expect(text).toContain(`<dd id="sScreen">${screenSize(salle)}</dd>`)
    expect(text).toContain(`<p id="sDesc">${salle.description}</p>`)
  })

  it('cite les fauteuils d’où la scène regarde l’écran', () => {
    expect(text).toContain(`${salle.selected} s'allume`)
    expect(text).toContain(`De ${salle.front} à ${salle.back}`)
    expect(text).toContain(coupeCaption(salle))
  })
})
