/*
 * La langue de la page : celle de sa balise <html lang> (« fr » sur fr.html et fr/demo.html, « en »
 * sur en.html…). Les scripts sont les mêmes pour toutes les langues ; ce qu'ils écrivent eux-mêmes
 * (« Copié », une étiquette de la coupe, un libellé de la démo) passe par `t`.
 *
 * Aucune liste de langues ici : elles se déclarent dans tools/pages.ts. Une langue nouvelle
 * fonctionne aussitôt ; ses textes manquants s'affichent dans la première langue écrite (l'anglais,
 * par convention), jusqu'à ce qu'on les traduise.
 *
 * Hors d'un navigateur (les tests), il n'y a pas de page : la langue est vide, et se passe en
 * argument là où elle compte.
 */
export const LANGUE: string = typeof document === 'undefined' ? '' : document.documentElement.lang

/** Un texte par langue : `{ en: 'Copied', fr: 'Copié' }`. L'anglais d'abord : c'est lui qui s'affiche quand la langue de la page manque. */
export type Textes<T = string> = Record<string, T>

/** Le texte dans la langue de la page ; à défaut, le premier écrit. */
export function t<T>(textes: Textes<T>, langue: string = LANGUE): T {
  return langue in textes ? textes[langue] : Object.values(textes)[0]
}

/** Le séparateur décimal d'une langue : « , » en français, « . » en anglais. */
const decimal = (langue: string) => {
  try {
    return new Intl.NumberFormat(langue || 'en').formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'
  } catch {
    return '.'
  }
}

/** Un nombre comme on l'écrit dans cette langue : « 9,40 » en français, « 9.40 » en anglais. */
export const nombre = (value: number, digits = 0, langue: string = LANGUE) => value.toFixed(digits).replace('.', decimal(langue))
