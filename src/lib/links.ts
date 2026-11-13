/**
 * Adresses du site, communes à ses deux pages :
 *   - la présentation (`index.html`), à l'adresse de base ;
 *   - la démo (`demo.html`), à l'adresse `/demo` — celle du QR code.
 */
export const HOME_PATH = import.meta.env.BASE_URL
export const DEMO_PATH = `${import.meta.env.BASE_URL}demo`

/** Le logo (blanc, pour fond sombre) : fichier `public/logo.svg`, tiré du kit du dossier `logo/`. */
export const LOGO_URL = `${import.meta.env.BASE_URL}logo.svg`

/**
 * Adresse complète de la démo, pour le QR code.
 * `null` en local : un téléphone n'a pas accès à `localhost`, le code ne mènerait nulle part.
 */
export function shareableDemoUrl(): string | null {
  const { protocol, hostname, origin } = window.location
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  return protocol.startsWith('http') && !local ? origin + DEMO_PATH : null
}
