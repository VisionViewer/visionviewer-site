/*
 * Les adresses du site : ce que vercel.json redirige et réécrit, appliqué aussi par le serveur de
 * développement (`npm run dev`) et par celui du site construit (`npm run preview`). Les trois
 * servent ainsi les mêmes adresses : `/` mène à la langue par défaut, `/blog` à `/fr/blog`, et
 * `/fr/blog` est le fichier `fr/blog.html`.
 *
 * vercel.json reste la seule source : rien n'est répété ici. Ce module en applique deux listes.
 *   redirects   une ancienne adresse → la nouvelle, en 308 (« permanent »). Avant tout le reste.
 *   rewrites    une adresse sans « .html » → le fichier qui la sert. Seulement si ce fichier existe :
 *               en ligne, Vercel sert d'abord les fichiers, et ne réécrit que ce qui reste.
 *
 * Une source est un chemin où `:nom` vaut pour un segment : « /blog/:article ». C'est le seul
 * motif que vercel.json emploie ici ; Vercel en accepte d'autres, que ce module ne connaît pas.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export interface Regle {
  source: string
  destination: string
  /** Une redirection permanente répond 308 ; Vercel répond 307 quand elle ne l'est pas */
  permanent?: boolean
}

export interface Routes {
  redirects: Regle[]
  rewrites: Regle[]
}

export function readRoutes(root: string = process.cwd()): Routes {
  const { redirects = [], rewrites = [] } = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as Partial<Routes>
  return { redirects, rewrites }
}

/** Où une règle mène ce chemin, ou `null` si elle ne le concerne pas : « /blog/x » par « /blog/:article » → « /fr/blog/x ». */
function follow({ source, destination }: Regle, path: string): string | null {
  const match = new RegExp(`^${source.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`).exec(path)
  return match ? destination.replace(/:(\w+)/g, (_, name: string) => match.groups?.[name] ?? '') : null
}

/** La première règle qui concerne ce chemin, et l'adresse où elle le mène. */
export function appliquer(regles: Regle[], path: string): { regle: Regle; vers: string } | null {
  for (const regle of regles) {
    const vers = follow(regle, path)
    if (vers !== null) return { regle, vers }
  }
  return null
}

/** Le fichier qui sert une adresse, d'après les réécritures : « /fr/blog » → « fr/blog.html ». `null` si aucune règle ne la concerne. */
export function fichierServi(routes: Routes, path: string): string | null {
  const found = appliquer(routes.rewrites, path)
  return found ? found.vers.slice(1) : null
}

/**
 * Applique les redirections et les réécritures de vercel.json à une requête. `files` : le dossier
 * où sont les fichiers servis (la racine en développement, `dist` pour le site construit).
 */
function middleware(root: string, files: string) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const routes = readRoutes(root)

    const redirect = appliquer(routes.redirects, url.pathname)
    if (redirect) {
      response.statusCode = redirect.regle.permanent ? 308 : 307
      response.setHeader('Location', redirect.vers + url.search)
      response.end()
      return
    }

    const served = fichierServi(routes, url.pathname)
    if (served && existsSync(join(files, served))) request.url = `/${served}${url.search}`
    next()
  }
}

export function siteRoutes(): Plugin {
  let root = process.cwd()
  let dist = 'dist'
  return {
    name: 'site-routes',
    configResolved(config) {
      root = config.root
      dist = join(config.root, config.build.outDir)
    },
    // Avant les propres règles de Vite, qui sans cela serviraient la mauvaise page pour « / »
    configureServer(server) {
      server.middlewares.use(middleware(root, root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(root, dist))
    },
  }
}
