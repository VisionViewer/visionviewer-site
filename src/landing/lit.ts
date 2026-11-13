/*
 * Les cadres au contour vert (landing.css, « Le contour qui s'allume ») s'allument au survol. Au
 * doigt, il n'y a pas de survol : le cadre s'allume donc quand on le touche, avec la même animation,
 * et le reste jusqu'à ce qu'on touche ailleurs.
 */

const LIT = 'is-lit'

/**
 * `boxes` : les cadres qui s'allument. Seuls le doigt et le stylet comptent ; à la souris, le survol
 * fait déjà le travail, et un clic ne doit pas laisser le cadre allumé derrière lui.
 */
export function setupTouchLight(boxes: HTMLElement[]): void {
  // Tout appui hors d'un cadre l'éteint : toucher ailleurs, c'est l'avoir quitté
  document.addEventListener(
    'pointerdown',
    (event) => {
      for (const box of boxes) {
        if (!(event.target instanceof Node) || !box.contains(event.target)) box.classList.remove(LIT)
      }
    },
    { capture: true, passive: true },
  )
  for (const box of boxes) {
    // Le doigt se relève sur le cadre : c'est un toucher. Quand il fait défiler la page, le
    // navigateur annule le geste (« pointercancel ») et rien ne s'allume au passage.
    box.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') box.classList.add(LIT)
    })
  }
}
