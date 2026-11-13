/*
 * Bandeaux d'information (sonner), chargés à part : ils ne servent qu'après une action de
 * l'utilisateur, la page n'a pas à les attendre pour s'afficher.
 */
import { lazy } from 'react'

const load = () => import('sonner')

/** À placer une fois dans l'application : l'emplacement où s'affichent les bandeaux. */
export const Toaster = lazy(() => load().then((module) => ({ default: module.Toaster })))

type Toast = (typeof import('sonner'))['toast']

/** Affiche un bandeau : `notify((toast) => toast.success('…'))`. */
export function notify(show: (toast: Toast) => void): void {
  load().then(({ toast }) => show(toast), () => {
    // Hors ligne : pas de bandeau, l'action elle-même a déjà eu lieu
  })
}
