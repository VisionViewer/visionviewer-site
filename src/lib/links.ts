/**
 * Adresses du site, dans la langue de la page : chaque langue a les siennes, sous son préfixe.
 *   - la présentation (`fr.html`, `en.html`…), à l'adresse `/fr`, `/en`… ;
 *   - la démo (`fr/demo.html`…), à l'adresse `/fr/demo`, `/en/demo`… — celle du QR code.
 * Un lien écrit ici ne passe par aucune redirection : il mène droit à la page, dans sa langue.
 */
import { LANGUE } from './langue'

const BASE = import.meta.env.BASE_URL

export const HOME_PATH = `${BASE}${LANGUE}`
export const DEMO_PATH = `${BASE}${LANGUE}/demo`

/** Le logo (blanc, pour fond sombre) : fichier `public/logo.svg`, tiré du kit du dossier `logo/`. */
export const LOGO_URL = `${BASE}logo.svg`

/**
 * Adresse complète de la démo, pour le QR code : celle de la langue de la page.
 * `null` en local : un téléphone n'a pas accès à `localhost`, le code ne mènerait nulle part.
 */
export function shareableDemoUrl(): string | null {
  const { protocol, hostname, origin } = window.location
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  return protocol.startsWith('http') && !local ? origin + DEMO_PATH : null
}
