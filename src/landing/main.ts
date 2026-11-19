/*
 * Page de présentation : tout ce qui n'est pas la scène 3D.
 * Liens vers la démo, QR code, coupe de la salle, menu de l'intégration, adresse de contact,
 * carrousel des chiffres.
 */
import { DEMO_PATH, shareableDemoUrl } from '../lib/links'
import { drawCoupe } from './coupe'
import { halls } from './halls'
import { setupTouchLight } from './lit'
import { setupWays } from './ways'


const $ = (id: string) => document.getElementById(id)!

// Anciens liens : `/?demo` ouvrait la démo
if (new URLSearchParams(window.location.search).has('demo')) window.location.replace(DEMO_PATH)

// « Essayez maintenant » mène à la démo, sur le plan de salle : au visiteur de choisir son fauteuil
for (const link of document.querySelectorAll<HTMLAnchorElement>('.demo-link')) {
  link.href = DEMO_PATH
}

// Fig. 1 : la coupe de la première salle de la démo, redessinée à la largeur disponible
// (sur téléphone, elle tient ainsi en entier dans l'écran)
const coupe = $('coupe')
let coupeWidth = -1
const drawFigure = () => {
  if (coupe.clientWidth === coupeWidth) return
  coupeWidth = coupe.clientWidth
  drawCoupe(coupe, halls[0], coupeWidth)
}
drawFigure()
new ResizeObserver(drawFigure).observe(coupe)

// Le QR code mène à la démo, sur le plan de salle. Son générateur est chargé à part, et
// seulement là où le code s'affiche (pas sur écran tactile, voir landing.css).
const demoUrl = shareableDemoUrl()
if (demoUrl && !window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
  import('../lib/qr').then(({ qrSvg }) => {
    const qr = $('qr')
    qr.innerHTML = qrSvg(demoUrl, 'QR code vers la démo')
    qr.classList.add('on')
  })
}

// Section Intégration : les deux façons de se brancher, en menu dépliant
setupWays($('integrations'))

// Les cadres au contour vert : au doigt, ils s'allument au toucher
setupTouchLight(Array.from(document.querySelectorAll<HTMLElement>('.duo article, .acc')))

// --- Adresse de contact ------------------------------------------------------
// L'adresse est écrite dans la page (src/pages/societe.json) : ici, seulement de quoi la copier
const address = $('addr')
const copy = $('copy')
const CONTACT = address.textContent ?? ''
copy.addEventListener('click', () => {
  const copied = () => {
    copy.textContent = 'Adresse copiée'
    window.setTimeout(() => (copy.textContent = "Copier l'adresse"), 1800)
  }
  // Sans accès au presse-papiers, l'adresse est sélectionnée : il reste à la copier
  const select = () => {
    const range = document.createRange()
    range.selectNodeContents(address)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    copy.textContent = 'Adresse sélectionnée'
  }
  try {
    navigator.clipboard.writeText(CONTACT).then(copied, select)
  } catch {
    select()
  }
})

// --- Carrousel des chiffres ---------------------------------------------------
// Sans fin : trois copies des chiffres, on reste toujours sur celle du milieu
const kpis = $('kpis')
const cards = Array.from(kpis.children) as HTMLElement[]
const GAP = 22
for (const side of [0, 1]) {
  for (const card of cards) {
    const clone = card.cloneNode(true) as HTMLElement
    clone.setAttribute('aria-hidden', 'true')
    if (side) kpis.appendChild(clone)
    else kpis.insertBefore(clone, cards[0])
  }
}
const unit = () => cards[0].offsetWidth + GAP
const setWidth = () => unit() * cards.length
const jump = (x: number) => {
  kpis.style.scrollSnapType = 'none'
  kpis.scrollLeft = x
  void kpis.offsetWidth
  kpis.style.scrollSnapType = ''
}
const recentre = () => {
  const width = setWidth()
  if (!width) return
  if (kpis.scrollLeft < width * 0.5) jump(kpis.scrollLeft + width)
  else if (kpis.scrollLeft >= width * 1.5) jump(kpis.scrollLeft - width)
}
const home = () => jump(setWidth())
home()
window.addEventListener('load', home)
// Seulement si la largeur change : sur téléphone, la barre d'adresse qui se replie redimensionne aussi
let lastWidth = window.innerWidth
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return
  lastWidth = window.innerWidth
  home()
})
let settle = 0
kpis.addEventListener(
  'scroll',
  () => {
    window.clearTimeout(settle)
    settle = window.setTimeout(recentre, 140)
  },
  { passive: true },
)
const step = (direction: number) => {
  recentre()
  kpis.scrollBy({ left: direction * unit(), behavior: 'smooth' })
}
$('kPrev').addEventListener('click', () => step(-1))
$('kNext').addEventListener('click', () => step(1))

// --- Scène 3D -----------------------------------------------------------------
// Chargée à part : si WebGL manque, la page reste lisible (voir `.no-gl` dans landing.css)
import('./scene.js').catch((error: unknown) => {
  console.error('[VisionViewer] Scène 3D indisponible :', error)
  document.documentElement.classList.add('no-gl')
})
