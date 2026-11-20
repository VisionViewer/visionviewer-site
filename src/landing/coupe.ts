/*
 * Fig. 1 : coupe de la salle en points, tracée à partir des mêmes cotes que la scène 3D
 * et que la démo. Dessin repris de la maquette (visionviewer-landing.html), rendu adaptable :
 * la coupe se dessine à la largeur disponible, pour tenir en entier sur un téléphone.
 */
import { en, fr, num, type Hall } from './halls'
import { EN, t } from './langue'

/** Échelle de la maquette, en pixels par mètre : celle des grands écrans */
const FULL_SCALE = 52
const GROUND_Y = 400 // le sol du premier rang
const GREEN = '#5fd08a'
const RED = '#e0353e'
const DOTTED = ' fill="none" stroke-linecap="round" stroke-linejoin="round"'

/**
 * Dessine la coupe de `hall` dans `target`, avec le champ de vision du fauteuil présélectionné.
 * `width` : largeur disponible en pixels. En dessous de la largeur de la maquette, l'échelle
 * diminue mais le texte garde sa taille, pour rester lisible.
 */
export function drawCoupe(target: HTMLElement, hall: Hall, width = target.clientWidth): void {
  const d = hall.dim
  const rows = hall.rows.length
  const end = d.firstRow + (rows - 1) * d.rowGap + 1.3 // fond de la salle (m)

  // L'écran est à gauche, précédé de la place de sa légende verticale
  const narrow = width > 0 && width < 620
  const originX = narrow ? 34 : 70
  const right = narrow ? 8 : 30
  const scale = width > 0 ? Math.min(FULL_SCALE, (width - originX - right) / end) : FULL_SCALE
  const k = scale / FULL_SCALE
  /** Une cote de la maquette, réduite avec l'échelle sans descendre sous `min` */
  const px = (value: number, min = 0) => Math.max(value * k, min)
  const round = (value: number) => Math.round(value * 10) / 10
  const X = (z: number) => round(originX + z * scale)
  const Y = (y: number) => round(GROUND_Y - y * scale)

  const seat = hall.seats.find((s) => s.id === hall.selected)
  const row = seat ? seat.row : 0
  const top = d.screenBottom + d.screenH
  const eyeZ = d.firstRow + row * d.rowGap
  const eyeY = row * d.step + d.eye

  // Le sol, marche par marche
  let floor = `M${X(-0.6)} ${GROUND_Y} L${X(d.firstRow - 0.55)} ${GROUND_Y}`
  for (let r = 1; r < rows; r++) {
    const z = d.firstRow + r * d.rowGap - 0.55
    floor += ` L${X(z)} ${Y((r - 1) * d.step)} L${X(z)} ${Y(r * d.step)}`
  }
  floor += ` L${X(end)} ${Y((rows - 1) * d.step)}`

  let svg = ''
  // Champ de vision du fauteuil, des yeux aux bords haut et bas de l'écran
  svg += `<polygon points="${X(eyeZ)},${Y(eyeY)} ${X(0)},${Y(top)} ${X(0)},${Y(d.screenBottom)}" fill="rgba(95,208,138,.07)" stroke="${GREEN}" stroke-width="1" stroke-opacity=".7"/>`
  svg += `<path d="${floor}"${DOTTED} stroke="rgba(245,245,246,.5)" stroke-width="${round(px(2, 1.3))}" stroke-dasharray="0 ${round(px(7, 3.2))}"/>`
  svg += `<line x1="${X(0)}" x2="${X(0)}" y1="${Y(d.screenBottom)}" y2="${Y(top)}" stroke="#fff" stroke-width="${round(px(4, 2.5))}" stroke-linecap="round" style="filter:drop-shadow(0 0 ${round(px(10, 5))}px rgba(255,255,255,.9))"/>`
  // Les fauteuils, vus de profil : une assise et un dossier en pointillés. À petite échelle,
  // ils sont dessinés un peu plus grands que nature, pour rester reconnaissables
  const g = Math.max(k, 0.42)
  const seatStroke = round(px(4, 1.8))
  const seatDash = round(px(7.4, 3))
  for (let r = 0; r < rows; r++) {
    const x = X(d.firstRow + r * d.rowGap)
    const y = Y(r * d.step)
    const at = (dx: number, dy: number) => `${round(x + dx * g)} ${round(y - dy * g)}`
    svg += `<path d="M${at(-10, 23)} L${at(12, 23)} L${at(16, 54)}"${DOTTED} stroke="${r === row ? GREEN : RED}" stroke-width="${seatStroke}" stroke-dasharray="0 ${seatDash}"/>`
    svg += `<text x="${x}" y="${GROUND_Y + (narrow ? 22 : 28)}" text-anchor="middle"${r === row ? ' class="on"' : ''}>${hall.rows[r]}</text>`
  }
  svg += `<circle cx="${X(eyeZ)}" cy="${Y(eyeY)}" r="${round(px(4.5, 3))}" fill="${GREEN}" style="filter:drop-shadow(0 0 8px ${GREEN})"/>`
  svg += `<text transform="translate(${X(0) - (narrow ? 12 : 18)} ${Y(d.screenBottom + d.screenH / 2)}) rotate(-90)" text-anchor="middle">${t('Écran', 'Screen')} ${num(d.screenH, 2)} m</text>`
  svg += `<text class="on" x="${X(eyeZ / 2)}" y="${round(Y((eyeY + top) / 2) - 12)}" text-anchor="middle">${num(hall.distance, 1)} m</text>`
  svg += `<text x="${X(end)}" y="${round(Y((rows - 1) * d.step) + (narrow ? 20 : 28))}" text-anchor="end">${t('Pente', 'Slope')} ${num(hall.slope)}°</text>`

  // Le cadre suit la salle : du dessus de l'écran aux lettres des rangées
  const viewTop = Math.round(Math.min(narrow ? GROUND_Y : 100, Y(top) - (narrow ? 22 : 28)))
  const viewBottom = GROUND_Y + (narrow ? 34 : 45)
  const label = t(
    `Coupe de la salle ${hall.name} : écran de ${num(d.screenH, 2)} m à gauche, ${rows} rangs en gradin, champ de vision du fauteuil ${hall.selected} à ${num(hall.distance, 1)} m`,
    `Cross-section of ${hall.name}: ${num(d.screenH, 2)} m screen on the left, ${rows} stepped rows, field of view from seat ${hall.selected}, ${num(hall.distance, 1)} m away`,
  )
  target.innerHTML = `<svg viewBox="0 ${viewTop} ${round(X(end) + right)} ${viewBottom - viewTop}" role="img" aria-label="${label}">${svg}</svg>`
}

/** Légende de la figure, citée telle quelle dans index.html et, en anglais, dans en.html. */
export const coupeCaption = (hall: Hall, english = EN) =>
  english
    ? `Fig. 1 — Section · ${hall.name} · ${hall.selected} · ${en(hall.distance, 1)} m · ${en(hall.angle)}°`
    : `Fig. 1 — Coupe · ${hall.name} · ${hall.selected} · ${fr(hall.distance, 1)} m · ${fr(hall.angle)}°`
