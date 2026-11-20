/*
 * Les adresses du site : ce que vercel.json redirige et réécrit, appliqué aussi par le serveur de
 * développement (`npm run dev`) et par celui du site construit (`npm run preview`). Les trois
 * servent ainsi les mêmes adresses : `/` mène à la langue par défaut, `/blog` à `/fr/blog`, et
 * `/fr/blog` est le fichier `fr/blog.html`.
 *
 * vercel.json reste la seule source : rien n'est répété ici. Ce module en applique trois réglages,
 * dans l'ordre où Vercel les applique.
 *   trailingSlash  `false` : une adresse terminée par « / » mène, en 308, à la même sans « / ».
 *   redirects      une ancienne adresse → la nouvelle, en 308 (« permanent »).
 *   rewrites       une adresse sans « .html » → le fichier qui la sert. Seulement si ce fichier
 *                  existe : en ligne, Vercel sert d'abord les fichiers, et ne réécrit que ce qui reste.
 *
 * Une source est un chemin où `:nom` vaut pour un segment : « /blog/:article ». Une règle peut
 * dépendre d'un paramètre de l'adresse (`has`, de type `query` : « /?demo »). Ce sont les seuls
 * motifs que vercel.json emploie ici ; Vercel en accepte d'autres, que ce module ne connaît pas et
 * n'applique donc jamais : une condition sur l'hôte, un en-tête ou un cookie ferait dépendre la
 * page de qui la demande, ce que le site s'interdit (un test le refuse).
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
  /** Ce que la requête doit porter pour que la règle vaille. Ici, seulement un paramètre de l'adresse. */
  has?: { type: string; key?: string; value?: string }[]
}

export interface Routes {
  trailingSlash?: boolean
  redirects: Regle[]
  rewrites: Regle[]
}

export function readRoutes(root: string = process.cwd()): Routes {
  const { trailingSlash, redirects = [], rewrites = [] } = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as Partial<Routes>
  return { trailingSlash, redirects, rewrites }
}

/** Où une règle mène ce chemin, ou `null` si elle ne le concerne pas : « /blog/x » par « /blog/:article » → « /fr/blog/x ». */
function follow({ source, destination, has }: Regle, path: string, query: URLSearchParams): string | null {
  const wanted = (has ?? []).every((condition) => condition.type === 'query' && condition.key !== undefined && query.has(condition.key) && (condition.value === undefined || query.get(condition.key) === condition.value))
  if (!wanted) return null
  const match = new RegExp(`^${source.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`).exec(path)
  return match ? destination.replace(/:(\w+)/g, (_, name: string) => match.groups?.[name] ?? '') : null
}

/** La première règle qui concerne ce chemin (et, si elle en dépend, ses paramètres), et l'adresse où elle le mène. */
export function appliquer(regles: Regle[], path: string, query: URLSearchParams = new URLSearchParams()): { regle: Regle; vers: string } | null {
  for (const regle of regles) {
    const vers = follow(regle, path, query)
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
 * Ce que le site répond à une adresse, dans l'ordre de Vercel : une redirection (barre finale,
 * puis règles de vercel.json), sinon le fichier qui la sert s'il existe, sinon rien (`null` : au
 * serveur de servir un fichier tel quel, ou de répondre 404).
 */
export function repondre(routes: Routes, path: string, query: URLSearchParams, existe: (file: string) => boolean): { code: 307 | 308; vers: string } | { fichier: string } | null {
  if (routes.trailingSlash === false && path.length > 1 && path.endsWith('/')) return { code: 308, vers: path.replace(/\/+$/, '') }
  const redirect = appliquer(routes.redirects, path, query)
  if (redirect) return { code: redirect.regle.permanent ? 308 : 307, vers: redirect.vers }
  const served = fichierServi(routes, path)
  return served && existe(served) ? { fichier: served } : null
}

/**
 * Applique vercel.json à une requête. `files` : le dossier où sont les fichiers servis (la racine
 * en développement, `dist` pour le site construit).
 */
function middleware(root: string, files: string) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const answer = repondre(readRoutes(root), url.pathname, url.searchParams, (file) => existsSync(join(files, file)))
    if (answer && 'vers' in answer) {
      response.statusCode = answer.code
      response.setHeader('Location', answer.vers + url.search)
      response.end()
      return
    }
    if (answer) request.url = `/${answer.fichier}${url.search}`
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
