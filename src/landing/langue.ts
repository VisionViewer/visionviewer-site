/*
 * La langue de la page de présentation : celle de sa balise <html> (`index.html` en français,
 * `en.html` en anglais). Les deux pages partagent leurs scripts ; ce que ces scripts écrivent
 * eux-mêmes (une étiquette de la coupe, « Copié »…) passe par `t`.
 * Hors d'un navigateur (les tests), la langue est le français.
 */
export const EN = typeof document !== 'undefined' && document.documentElement.lang === 'en'

/** Le texte dans la langue de la page. */
export const t = (fr: string, en: string) => (EN ? en : fr)
