/*
 * Section Intégration : le menu dépliant des deux façons de se brancher, et la copie de leur code.
 * L'ouverture elle-même est animée par landing.css ; ici, l'état, et la tenue de la page pendant
 * qu'elle se déplie.
 */
import { t } from '../lib/langue'

/** Durée du dépliage, en millisecondes : celle de `.acc__panel` dans landing.css, avec une marge. */
const UNFOLD = 700

/** La tenue en cours : un nouveau clic l'interrompt. */
let holding: AbortController | null = null

/**
 * Garde `anchor` à la même hauteur dans la fenêtre pendant que les panneaux changent de taille.
 * Sans cela, ouvrir la façon du bas pendant que celle du haut se referme l'emporte hors de l'écran :
 * on se retrouve au milieu d'un contenu, sans son titre. Dès que le lecteur fait défiler la page
 * lui-même, il reprend la main.
 */
function hold(anchor: HTMLElement): void {
  holding?.abort()
  const watch = new AbortController()
  holding = watch
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.addEventListener(type, () => watch.abort(), { signal: watch.signal, passive: true })
  }
  const top = anchor.getBoundingClientRect().top
  const end = performance.now() + UNFOLD
  const step = () => {
    if (watch.signal.aborted) return
    const drift = anchor.getBoundingClientRect().top - top
    // « instant » : la page défile en douceur par défaut, ce qui ferait courir le titre après sa place
    if (Math.abs(drift) >= 1) window.scrollBy({ top: drift, behavior: 'instant' })
    if (performance.now() < end) requestAnimationFrame(step)
    else watch.abort()
  }
  step()
}

/** Une seule façon ouverte à la fois ; recliquer sur celle qui est ouverte la referme. */
export function setupWays(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.acc'))
  const setOpen = (item: HTMLElement, open: boolean) => {
    item.classList.toggle('is-open', open)
    item.querySelector('.acc__head')?.setAttribute('aria-expanded', String(open))
  }
  for (const item of items) {
    const head = item.querySelector<HTMLElement>('.acc__head')
    head?.addEventListener('click', () => {
      const open = !item.classList.contains('is-open')
      for (const other of items) setOpen(other, other === item && open)
      hold(head)
    })
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('.code__copy')) {
    const code = button.closest('.code')?.querySelector('pre')
    if (!code) continue
    let reset = 0
    button.addEventListener('click', async () => {
      // Le texte du bloc, sans ses balises de mise en couleur
      const text = code.textContent ?? ''
      let copied = false
      try {
        await navigator.clipboard.writeText(text)
        copied = true
      } catch {
        // Sans accès au presse-papiers, le code est sélectionné : il reste à le copier
        const range = document.createRange()
        range.selectNodeContents(code)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      button.textContent = copied ? t({ en: 'Copied', fr: 'Copié' }) : t({ en: 'Selected', fr: 'Sélectionné' })
      window.clearTimeout(reset)
      reset = window.setTimeout(() => (button.textContent = t({ en: 'Copy', fr: 'Copier' })), 1800)
    })
  }
}
