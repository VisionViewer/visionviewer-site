/*
 * Les pages du site autres que la présentation et la démo : pages légales, blog, articles.
 *
 * Ce sont des fichiers HTML ordinaires, à la racine du site et dans `blog/`. Ce module leur donne
 * ce qu'elles ont en commun, à la construction comme en développement, sans rien charger dans le
 * navigateur :
 *
 *   <!--@include nom-->      le morceau `src/pages/partials/nom.html` (en-tête, pied de page…)
 *   <!--@sommaire-->         le sommaire de la page : un lien par section (<h2 id="…">)
 *   {{contact}}, {{societe.siege}}…   les valeurs de `src/pages/societe.json`
 *   <!--@articles rubrique | texte si vide-->   la liste des articles d'une rubrique du blog
 *
 * Une valeur de `societe.json` laissée à `null` s'affiche « À compléter » : la société est en
 * cours de formation, son adresse et son numéro d'immatriculation viendront avec elle.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const PARTIALS = 'src/pages/partials'
const SOCIETE = 'src/pages/societe.json'
const BLOG = 'blog'

/** Ce que les mentions légales doivent dire de la société ; `null` : pas encore connu. */
type Societe = Record<string, string | null>

/** Ce qui s'affiche à la place d'une valeur encore inconnue */
const LIBELLES: Record<string, string> = {
  capital: 'montant du capital social',
  siege: 'adresse du siège social',
  rcs: 'numéro et ville d’immatriculation au RCS',
  tva: 'numéro de TVA intracommunautaire',
  directeur: 'nom du directeur de la publication',
  telephone: 'numéro de téléphone',
  hebergeurTelephone: 'numéro de téléphone de l’hébergeur',
}

/** Les rubriques du blog, et le nom que porte un de leurs articles */
const RUBRIQUES: Record<string, string> = {
  enquete: 'Enquête',
  article: 'Article',
  'etude-de-cas': 'Étude de cas',
}

interface Article {
  href: string
  rubrique: string
  /** « 2026-11-19 » */
  date: string
  /** Temps de lecture, en minutes */
  lecture: string
  title: string
  summary: string
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8')

/** « 19 novembre 2026 » */
const frenchDate = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

const meta = (html: string, name: string): string => new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`).exec(html)?.[1] ?? ''

/** Les pages du site : celles de la racine, et les articles du blog. */
function pageFiles(root: string): string[] {
  const html = (dir: string) =>
    readdirSync(join(root, dir))
      .filter((file) => file.endsWith('.html'))
      .map((file) => (dir ? `${dir}/${file}` : file))
  return [...html(''), ...html(BLOG)]
}

/** Les entrées de la construction : une par page, nommée d'après son chemin. */
export function pageInputs(root: string = process.cwd()): Record<string, string> {
  return Object.fromEntries(pageFiles(root).map((file) => [file.replace(/\.html$/, '').replace(/\//g, '-'), file]))
}

/** Ce que chaque article dit de lui-même, dans son en-tête ; les plus récents d'abord. */
function articles(root: string): Article[] {
  return readdirSync(join(root, BLOG))
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const html = read(root, `${BLOG}/${file}`)
      const article: Article = {
        href: `/${BLOG}/${file.replace(/\.html$/, '')}`,
        rubrique: meta(html, 'vv:rubrique'),
        date: meta(html, 'vv:date'),
        lecture: meta(html, 'vv:lecture'),
        title: /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].trim() ?? '',
        summary: meta(html, 'description'),
      }
      if (!RUBRIQUES[article.rubrique] || !/^\d{4}-\d{2}-\d{2}$/.test(article.date) || !article.title || !article.summary)
        throw new Error(`${BLOG}/${file} : il manque à l'article sa rubrique (vv:rubrique), sa date (vv:date), son titre (<h1>) ou son résumé (description).`)
      return article
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

const byline = (article: Article) => `${RUBRIQUES[article.rubrique]} · ${frenchDate(article.date)}${article.lecture ? ` · ${article.lecture} min de lecture` : ''}`

const card = (article: Article) => `<a class="card" href="${article.href}">
  <span class="mono">${byline(article)}</span>
  <h3>${article.title}</h3>
  <p>${article.summary}</p>
  <span class="card__go">Lire l’article<span aria-hidden="true">→</span></span>
</a>`

/** Applique à une page ses morceaux communs, les valeurs de la société et les listes d'articles. */
export function renderPage(root: string, file: string, source: string): string {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  const fail = (message: string): never => {
    throw new Error(`${file} : ${message}`)
  }

  let html = source.replace(/<!--@include ([\w-]+)-->/g, (_, name: string) => read(root, `${PARTIALS}/${name}.html`).trim())

  // Le sommaire d'une page : un lien par titre de section (<h2 id="…">)
  html = html.replace('<!--@sommaire-->', () => {
    const titles = [...html.matchAll(/<h2 id="([\w-]+)">([\s\S]*?)<\/h2>/g)]
    if (titles.length === 0) fail('un sommaire est demandé, mais aucune section n’a d’identifiant (<h2 id="…">).')
    return `<nav class="sommaire" aria-label="Sommaire">\n<span class="mono">Sommaire</span>\n${titles.map(([, id, title]) => `<a href="#${id}">${title.trim()}</a>`).join('\n')}\n</nav>`
  })

  // Dans le menu du haut, le lien de la rubrique où l'on se trouve est marqué
  if (file === 'blog.html' || file.startsWith(`${BLOG}/`)) html = html.replace('<a href="/blog">Blog</a>', '<a href="/blog" aria-current="page">Blog</a>')

  const all = /<!--@articles /.test(html) ? articles(root) : []
  html = html.replace(/<!--@articles ([\w-]+)(?: \| ([^>]*?))?-->/g, (_, rubrique: string, empty = '') => {
    if (!RUBRIQUES[rubrique]) fail(`rubrique inconnue « ${rubrique} ».`)
    const list = all.filter((article) => article.rubrique === rubrique)
    return list.length ? `<div class="cards">${list.map(card).join('\n')}</div>` : `<p class="vide">${empty}</p>`
  })

  const self = file.startsWith(`${BLOG}/`) ? { rubrique: meta(source, 'vv:rubrique'), date: meta(source, 'vv:date'), lecture: meta(source, 'vv:lecture') } : null

  return html.replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => {
    if (key === 'contact') return societe.contact ?? fail('adresse de contact absente de societe.json.')
    if (key === 'annee') return String(new Date().getUTCFullYear())
    if (key === 'version') return frenchDate(societe.version ?? fail('date de version absente de societe.json.'))
    if (key === 'article.signature' && self) return `${RUBRIQUES[self.rubrique]} · ${frenchDate(self.date)} · ${self.lecture} min de lecture`
    if (key.startsWith('societe.')) {
      const field = key.slice('societe.'.length)
      if (!(field in societe)) fail(`« ${key} » n'existe pas dans societe.json.`)
      return societe[field] ?? `<span class="todo">À compléter : ${LIBELLES[field] ?? field}</span>`
    }
    return fail(`valeur inconnue « {{${key}}} ».`)
  })
}

/** Ce que `societe.json` ne dit pas encore : à renseigner avant de publier les pages légales. */
export function missingFields(root: string = process.cwd()): string[] {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  return Object.keys(societe).filter((field) => societe[field] === null).map((field) => LIBELLES[field] ?? field)
}

export function sitePages(): Plugin {
  let root = process.cwd()
  /** Vrai pendant une construction du site : c'est là, et une seule fois, que les manques sont rappelés */
  let building = false
  return {
    name: 'site-pages',
    configResolved(config) {
      root = config.root
      building = config.command === 'build' && !process.env.VITEST
    },
    // Un morceau commun ou la fiche de la société modifiés : la page ouverte se recharge
    configureServer(server) {
      server.watcher.add([join(root, PARTIALS), join(root, SOCIETE)])
      server.watcher.on('change', (changed) => {
        if (changed.includes(PARTIALS) || changed.endsWith(SOCIETE)) server.ws.send({ type: 'full-reload' })
      })
    },
    transformIndexHtml: {
      // Avant Vite : les feuilles de style et les scripts que les morceaux annoncent sont pris en charge comme ceux de la page
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.filename.slice(root.length + 1).split('\\').join('/')
        return renderPage(root, file, html)
      },
    },
    closeBundle() {
      if (!building) return
      building = false
      const missing = missingFields(root)
      if (missing.length) console.warn(`\n[pages légales] ${missing.length} mention(s) encore « À compléter » dans ${SOCIETE} :\n${missing.map((label) => `  - ${label}`).join('\n')}\n`)
    },
  }
}
