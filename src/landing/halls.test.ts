import { describe, expect, it } from 'vitest'
import { CODES } from '../../tools/pages'
import { layouts } from '../data/rooms'
import { nombre } from '../lib/langue'
import { roomTexts } from '../lib/room'
import { coupeCaption } from './coupe'
import { halls, hallsIn, screenSize, type Hall } from './halls'

/** Le texte de la présentation de chaque langue : `fr.html`, `en.html`… */
const pages = import.meta.glob<string>('../../*.html', { query: '?raw', import: 'default', eager: true })
const pageText = (langue: string) => (pages[`../../${langue}.html`] ?? '').replace(/&nbsp;/g, ' ')

const salle = halls[0]

/**
 * Ce que la présentation de chaque langue écrit, à la main, de la première salle de la démo. C'est
 * du contenu : une langue nouvelle ajoute ici ses phrases, telles qu'elles sont dans sa page.
 */
const PHRASES: Record<string, (hall: Hall, langue: string) => string[]> = {
  fr: (hall, langue) => [
    `${hall.name}. Onze rangs, ${hall.places} places.`,
    `Écran de ${screenSize(hall, langue)}, pente de ${nombre(hall.slope, 0, langue)}°, ${nombre(hall.dim.rowGap, 2, langue)} m entre les rangs, ${hall.pmrCount} emplacements PMR.`,
    `${hall.selected} s'allume`,
    `De ${hall.front} à ${hall.back}`,
  ],
  en: (hall, langue) => [
    `${hall.name}. Eleven rows, ${hall.places} seats.`,
    `A ${screenSize(hall, langue)} screen, an ${nombre(hall.slope, 0, langue)}° slope, ${nombre(hall.dim.rowGap, 2, langue)} m between rows, ${hall.pmrCount} wheelchair spaces.`,
    `${hall.selected} lights up`,
    `From ${hall.front} to ${hall.back}`,
  ],
}

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
    expect(salle.rows.length).toBe(11)
  })

  it('se décrivent dans chaque langue sans changer leurs chiffres', () => {
    for (const langue of CODES) {
      hallsIn(langue).forEach((hall, i) => {
        const { name, description } = roomTexts(layouts[i].config, langue)
        expect(hall, `${langue} · ${name}`).toMatchObject({ name, description, places: halls[i].places, selected: halls[i].selected, distance: halls[i].distance, angle: halls[i].angle })
      })
    }
    // Une salle traduite ne garde rien de sa langue d'origine
    for (const hall of hallsIn('en')) expect(hall.description, hall.name).not.toMatch(/rangs|places|salle/)
    expect(hallsIn('en')[0].name).toBe('Auditorium 1')
  })

  it('écrivent leurs nombres comme la langue de la page', () => {
    expect(screenSize(salle, 'fr')).toBe('9,40 × 3,93 m')
    expect(screenSize(salle, 'en')).toBe('9.40 × 3.93 m')
  })
})

// Le texte de la présentation est écrit à la main, dans chaque langue : ces tests signalent un
// chiffre resté en arrière quand le JSON de la première salle change.
describe('Texte de la page de présentation', () => {
  it('est vérifié dans chaque langue déclarée', () => {
    for (const langue of CODES) {
      expect(pageText(langue), `${langue}.html : la présentation de cette langue`).not.toBe('')
      expect(PHRASES[langue], `les phrases de la présentation en « ${langue} » (PHRASES, dans ce fichier)`).toBeDefined()
    }
  })

  for (const langue of CODES) {
    const hall = hallsIn(langue)[0]
    const text = pageText(langue)

    it(`cite les chiffres de la première salle de la démo (${langue})`, () => {
      for (const phrase of PHRASES[langue]?.(hall, langue) ?? []) expect(text, `${langue}.html`).toContain(phrase)
      expect(text).toContain(`<dd id="sName">${hall.name}</dd>`)
      expect(text).toContain(`<dd id="sPlaces">${hall.places}</dd>`)
      expect(text).toContain(`<dd id="sScreen">${screenSize(hall, langue)}</dd>`)
      expect(text).toContain(`<p id="sDesc">${hall.description}</p>`)
    })

    it(`cite la légende de la coupe (${langue})`, () => {
      expect(text).toContain(coupeCaption(hall, langue))
    })
  }
})
