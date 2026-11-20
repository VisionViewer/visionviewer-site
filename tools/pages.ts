/*
 * Les pages du site : la présentation, la démo, les pages légales, le blog et ses articles, en
 * français et, pour la présentation et le blog, en anglais (`en.html`, `en/`).
 *
 * Ce sont des fichiers HTML ordinaires. Ce module leur donne ce qu'elles ont en commun, à la
 * construction comme en développement, sans rien charger dans le navigateur :
 *
 *   <!--@include nom-->      le morceau `src/pages/partials/nom.html` (en-tête, pied de page…) ;
 *                            une page en anglais prend `nom.en.html` s'il existe
 *   <!--@sommaire-->         le sommaire de la page : un lien par section (<h2 id="…">)
 *   {{contact}}, {{societe.siege}}…   les valeurs de `src/pages/societe.json`
 *   {{traduction}}           l'adresse de la même page dans l'autre langue (à défaut, son accueil)
 *   <!--@articles rubrique | texte si vide-->   la liste des articles d'une rubrique du blog
 *   <!--@voir-aussi-->       dans un article : les autres articles de sa langue
 *   <!--@faq-->…<!--@/faq--> des questions (`data-q`) et leurs réponses (`data-a`), reprises
 *                            dans les données structurées de la page
 *
 * Il écrit aussi ce qui sert à être trouvé, par un moteur de recherche comme par un assistant :
 * dans l'en-tête de chaque page, son adresse canonique, sa traduction (`hreflang`) et ses données
 * structurées (schema.org) ; à la construction, `sitemap.xml` et `llms.txt`.
 *
 * Une valeur de `societe.json` laissée à `null` s'affiche « À compléter » : la société est en
 * cours de formation, son adresse et son numéro d'immatriculation viendront avec elle.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const PARTIALS = 'src/pages/partials'
const SOCIETE = 'src/pages/societe.json'
/** Le début de `llms.txt`, écrit à la main ; la liste des pages le suit */
const LLMS = 'src/pages/llms.md'

/** L'adresse du site en ligne : celle des adresses canoniques, du plan du site et des données structurées. */
export const SITE = 'https://visionviewer.net'
const IMAGE = `${SITE}/og-visionviewer.jpg`
const ORGANISATION = `${SITE}/#organisation`

export type Langue = 'fr' | 'en'

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

/** Ce que l'outil écrit lui-même dans une page, dans chaque langue */
const TEXTES: Record<
  Langue,
  {
    locale: string
    og: string
    /** Le nom que porte un article de chaque rubrique */
    rubriques: Record<string, string>
    lecture: (minutes: string) => string
    lire: string
    sommaire: string
    voirAussi: string
    /** Ce que VisionViewer est, en une phrase : la description de l'éditeur et du produit */
    produit: string
  }
> = {
  fr: {
    locale: 'fr-FR',
    og: 'fr_FR',
    rubriques: { enquete: 'Enquête', guide: 'Guide', article: 'Article', 'etude-de-cas': 'Étude de cas' },
    lecture: (minutes) => `${minutes} min de lecture`,
    lire: 'Lire l’article',
    sommaire: 'Sommaire',
    voirAussi: 'À lire aussi',
    produit:
      'VisionViewer montre à chaque spectateur la vue depuis sa place de cinéma, en 3D, avant le paiement. Chaque salle est modélisée à ses propres cotes ; la vue s’ajoute au site web et à l’application mobile du cinéma, sans changer de billetterie.',
  },
  en: {
    locale: 'en-US',
    og: 'en_US',
    rubriques: { enquete: 'Research', guide: 'Guide', article: 'Article', 'etude-de-cas': 'Case study' },
    lecture: (minutes) => `${minutes} min read`,
    lire: 'Read the article',
    sommaire: 'Contents',
    voirAussi: 'Read next',
    produit:
      'VisionViewer shows every moviegoer the view from their seat, in 3D, before they pay. Each auditorium is modeled to its real dimensions; the view plugs into the cinema’s website and mobile app, with no change of ticketing system.',
  },
}

/** Les pages qui existent dans les deux langues. Un article, lui, nomme sa traduction (`vv:traduction`). */
const PAIRES: [fr: string, en: string][] = [
  ['index.html', 'en.html'],
  ['blog.html', 'en/blog.html'],
]

interface Article {
  href: string
  rubrique: string
  /** « 2026-11-19 » */
  date: string
  /** Dernière mise à jour, si l'article en déclare une (`vv:maj`) */
  maj: string
  /** Temps de lecture, en minutes */
  lecture: string
  title: string
  summary: string
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8')

/** La version anglaise vit sous `/en` : `en.html` (la présentation), `en/blog.html`, `en/blog/*.html`. */
export const langueDe = (file: string): Langue => (file === 'en.html' || file.startsWith('en/') ? 'en' : 'fr')
const blogDir = (langue: Langue) => (langue === 'en' ? 'en/blog' : 'blog')
const blogFile = (langue: Langue) => `${blogDir(langue)}.html`
const homeFile = (langue: Langue) => (langue === 'en' ? 'en.html' : 'index.html')
const isArticle = (file: string) => /^(en\/)?blog\/[^/]+\.html$/.test(file)

/** L'adresse d'une page, sans « .html » : « / », « /blog », « /en »… */
export const pagePath = (file: string) => (file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`)
const pageUrl = (file: string) => SITE + pagePath(file)

/** « 19 novembre 2026 », « November 19, 2026 » */
const longDate = (day: string, langue: Langue) =>
  new Intl.DateTimeFormat(TEXTES[langue].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

const meta = (html: string, name: string): string => new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`).exec(html)?.[1] ?? ''

/** Le texte d'un fragment HTML : sans balises, entités traduites, blancs réunis. */
const ENTITES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", rsquo: '’', laquo: '«', raquo: '»', times: '×', mdash: '—', ndash: '–' }
export const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (entity, name: string) => ENTITES[name] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()

const title = (html: string) => texte(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '')
const heading = (html: string) => /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].trim() ?? ''

/** Une page que les moteurs ne doivent pas garder le dit elle-même, dans son en-tête. */
export const isIndexable = (html: string) => !/<meta\s+name="robots"\s+content="[^"]*noindex/.test(html)

/** Les pages du site : celles de la racine, les articles du blog, et leur version anglaise. */
function pageFiles(root: string): string[] {
  const html = (dir: string) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir))
          .filter((file) => file.endsWith('.html'))
          .map((file) => (dir ? `${dir}/${file}` : file))
      : []
  return [...html(''), ...html(blogDir('fr')), ...html('en'), ...html(blogDir('en'))]
}

/** Les entrées de la construction : une par page, nommée d'après son chemin. */
export function pageInputs(root: string = process.cwd()): Record<string, string> {
  return Object.fromEntries(pageFiles(root).map((file) => [file.replace(/\.html$/, '').replace(/\//g, '-'), file]))
}

/** Ce que chaque article d'une langue dit de lui-même, dans son en-tête ; les plus récents d'abord. */
function articles(root: string, langue: Langue): Article[] {
  const dir = blogDir(langue)
  if (!existsSync(join(root, dir))) return []
  return readdirSync(join(root, dir))
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const html = read(root, `${dir}/${file}`)
      const article: Article = {
        href: `/${dir}/${file.replace(/\.html$/, '')}`,
        rubrique: meta(html, 'vv:rubrique'),
        date: meta(html, 'vv:date'),
        maj: meta(html, 'vv:maj'),
        lecture: meta(html, 'vv:lecture'),
        title: heading(html),
        summary: meta(html, 'description'),
      }
      const day = /^\d{4}-\d{2}-\d{2}$/
      if (!TEXTES[langue].rubriques[article.rubrique] || !day.test(article.date) || (article.maj && !day.test(article.maj)) || !article.title || !article.summary)
        throw new Error(`${dir}/${file} : il manque à l'article sa rubrique (vv:rubrique), sa date (vv:date), son titre (<h1>) ou son résumé (description).`)
      return article
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.href.localeCompare(b.href))
}

const byline = (article: Pick<Article, 'rubrique' | 'date' | 'lecture'>, langue: Langue) =>
  `${TEXTES[langue].rubriques[article.rubrique]} · ${longDate(article.date, langue)}${article.lecture ? ` · ${TEXTES[langue].lecture(article.lecture)}` : ''}`

const card = (article: Article, langue: Langue) => `<a class="card" href="${article.href}">
  <span class="mono">${byline(article, langue)}</span>
  <h3>${article.title}</h3>
  <p>${article.summary}</p>
  <span class="card__go">${TEXTES[langue].lire}<span aria-hidden="true">→</span></span>
</a>`

/** La même page dans l'autre langue, si elle existe : son fichier. */
export function traduction(root: string, file: string, source: string): string | null {
  for (const [fr, en] of PAIRES) {
    if (file === fr) return en
    if (file === en) return fr
  }
  const path = meta(source, 'vv:traduction')
  if (!path) return null
  const target = `${path.replace(/^\//, '')}.html`
  if (!isArticle(target) || langueDe(target) === langueDe(file) || !existsSync(join(root, target)))
    throw new Error(`${file} : sa traduction (vv:traduction) « ${path} » n'est pas un article de l'autre langue.`)
  return target
}

/** Les questions d'une page et leurs réponses, entre <!--@faq--> et <!--@/faq-->. */
export function questions(file: string, html: string): { question: string; answer: string }[] {
  const blocks = [...html.matchAll(/<!--@faq-->([\s\S]*?)<!--@\/faq-->/g)].map(([, block]) => block)
  return blocks.flatMap((block) => {
    const asked = [...block.matchAll(/<(\w+)\b[^>]*\sdata-q\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , text]) => texte(text))
    const answered = [...block.matchAll(/<div\b[^>]*\sdata-a\b[^>]*>([\s\S]*?)<\/div>/g)].map(([, text]) => texte(text))
    if (asked.length === 0 || asked.length !== answered.length)
      throw new Error(`${file} : entre <!--@faq--> et <!--@/faq-->, ${asked.length} question(s) (data-q) pour ${answered.length} réponse(s) (data-a).`)
    return asked.map((question, i) => ({ question, answer: answered[i] }))
  })
}

/** Des données structurées, écrites dans la page. « < » y est codé : rien ne peut refermer la balise. */
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

/**
 * Ce qui sert à être trouvé, posé à la fin de l'en-tête : l'adresse canonique de la page, sa
 * traduction, et ses données structurées (qui édite le site, ce qu'est le produit, de quoi parle
 * un article, les questions auxquelles la page répond).
 */
function referencement(root: string, file: string, source: string, html: string, societe: Societe, faq: { question: string; answer: string }[]): string {
  const langue = langueDe(file)
  const url = pageUrl(file)
  const other = traduction(root, file, source)
  const text = TEXTES[langue]
  const article = isArticle(file)
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="${article ? 'article' : 'website'}" />`,
    `<meta property="og:locale" content="${text.og}" />`,
  ]
  if (other) {
    const urls = { [langue]: url, [langueDe(other)]: pageUrl(other) } as Record<Langue, string>
    tags.push(
      `<meta property="og:locale:alternate" content="${TEXTES[langueDe(other)].og}" />`,
      `<link rel="alternate" hreflang="fr" href="${urls.fr}" />`,
      `<link rel="alternate" hreflang="en" href="${urls.en}" />`,
      // Pour un lecteur d'une autre langue : la version anglaise
      `<link rel="alternate" hreflang="x-default" href="${urls.en}" />`,
    )
  }
  if (!isIndexable(html)) return tags.join('\n')

  const organisation = {
    '@type': 'Organization',
    '@id': ORGANISATION,
    name: 'VisionViewer',
    url: `${SITE}/`,
    logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
    email: societe.contact,
    description: text.produit,
  }
  const graph: unknown[] = []
  const crumbs = (...steps: [name: string, file: string][]) => ({
    '@type': 'BreadcrumbList',
    itemListElement: steps.map(([name, target], i) => ({ '@type': 'ListItem', position: i + 1, name, item: pageUrl(target) })),
  })

  if (file === homeFile(langue)) {
    graph.push(
      organisation,
      { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'VisionViewer', url: `${SITE}/`, inLanguage: ['fr', 'en'], publisher: { '@id': ORGANISATION } },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE}/#produit`,
        name: 'VisionViewer',
        url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: langue,
        description: text.produit,
        image: IMAGE,
        provider: { '@id': ORGANISATION },
      },
    )
  } else if (article) {
    const date = meta(source, 'vv:date')
    const maj = meta(source, 'vv:maj') || date
    tags.push(`<meta property="article:published_time" content="${date}" />`, `<meta property="article:modified_time" content="${maj}" />`)
    graph.push(
      organisation,
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: texte(heading(html)),
        description: meta(source, 'description'),
        inLanguage: langue,
        datePublished: date,
        dateModified: maj,
        articleSection: text.rubriques[meta(source, 'vv:rubrique')],
        image: IMAGE,
        url,
        mainEntityOfPage: url,
        author: { '@id': ORGANISATION },
        publisher: { '@id': ORGANISATION },
      },
      crumbs(['VisionViewer', homeFile(langue)], ['Blog', blogFile(langue)], [texte(heading(html)), file]),
    )
  } else if (file === blogFile(langue)) {
    graph.push(organisation, crumbs(['VisionViewer', homeFile(langue)], ['Blog', file]))
  }

  if (faq.length)
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: langue,
      mainEntity: faq.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
    })

  if (graph.length) tags.push(jsonLd({ '@context': 'https://schema.org', '@graph': graph }))
  return tags.join('\n')
}

/** Applique à une page ses morceaux communs, les valeurs de la société, les listes d'articles et son référencement. */
export function renderPage(root: string, file: string, source: string): string {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  const langue = langueDe(file)
  const text = TEXTES[langue]
  const fail = (message: string): never => {
    throw new Error(`${file} : ${message}`)
  }

  let html = source.replace(/<!--@include ([\w-]+)-->/g, (_, name: string) => {
    const translated = `${PARTIALS}/${name}.${langue}.html`
    return read(root, langue !== 'fr' && existsSync(join(root, translated)) ? translated : `${PARTIALS}/${name}.html`).trim()
  })

  // Le sommaire d'une page : un lien par titre de section (<h2 id="…">)
  html = html.replace('<!--@sommaire-->', () => {
    const titles = [...html.matchAll(/<h2 id="([\w-]+)">([\s\S]*?)<\/h2>/g)]
    if (titles.length === 0) fail('un sommaire est demandé, mais aucune section n’a d’identifiant (<h2 id="…">).')
    return `<nav class="sommaire" aria-label="${text.sommaire}">\n<span class="mono">${text.sommaire}</span>\n${titles.map(([, id, heading]) => `<a href="#${id}">${heading.trim()}</a>`).join('\n')}\n</nav>`
  })

  // Dans le menu du haut, le lien de la rubrique où l'on se trouve est marqué
  const blog = pagePath(blogFile(langue))
  if (file === blogFile(langue) || isArticle(file)) html = html.replace(`<a href="${blog}">Blog</a>`, `<a href="${blog}" aria-current="page">Blog</a>`)

  const all = /<!--@(articles |voir-aussi)/.test(html) ? articles(root, langue) : []
  html = html.replace(/<!--@articles ([\w-]+)(?: \| ([^>]*?))?-->/g, (_, rubrique: string, empty = '') => {
    if (!text.rubriques[rubrique]) fail(`rubrique inconnue « ${rubrique} ».`)
    const list = all.filter((article) => article.rubrique === rubrique)
    return list.length ? `<div class="cards">${list.map((article) => card(article, langue)).join('\n')}</div>` : `<p class="vide">${empty}</p>`
  })

  // Au bas d'un article : les autres articles de sa langue, les plus récents d'abord
  html = html.replace('<!--@voir-aussi-->', () => {
    const others = all.filter((article) => article.href !== pagePath(file)).slice(0, 3)
    return others.length ? `<section class="voir-aussi">\n<h2>${text.voirAussi}</h2>\n<div class="cards">${others.map((article) => card(article, langue)).join('\n')}</div>\n</section>` : ''
  })

  const self = isArticle(file) ? { rubrique: meta(source, 'vv:rubrique'), date: meta(source, 'vv:date'), lecture: meta(source, 'vv:lecture') } : null
  const other = traduction(root, file, source)

  html = html.replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => {
    if (key === 'contact') return societe.contact ?? fail('adresse de contact absente de societe.json.')
    if (key === 'annee') return String(new Date().getUTCFullYear())
    if (key === 'version') return longDate(societe.version ?? fail('date de version absente de societe.json.'), langue)
    if (key === 'traduction') return pagePath(other ?? homeFile(langue === 'fr' ? 'en' : 'fr'))
    if (key === 'article.signature' && self) return byline(self, langue)
    if (key.startsWith('societe.')) {
      const field = key.slice('societe.'.length)
      if (!(field in societe)) fail(`« ${key} » n'existe pas dans societe.json.`)
      return societe[field] ?? `<span class="todo">À compléter : ${LIBELLES[field] ?? field}</span>`
    }
    return fail(`valeur inconnue « {{${key}}} ».`)
  })

  // Les questions restent dans la page telles qu'elles sont écrites ; lues, leurs repères s'effacent
  const faq = questions(file, html)
  html = html.replace(/<!--@\/?faq-->/g, '')

  if (!html.includes('</head>')) fail('la page n’a pas d’en-tête (</head>).')
  return html.replace('</head>', () => `${referencement(root, file, source, html, societe, faq)}\n</head>`)
}

/** Ce que `societe.json` ne dit pas encore : à renseigner avant de publier les pages légales. */
export function missingFields(root: string = process.cwd()): string[] {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  return Object.keys(societe).filter((field) => societe[field] === null).map((field) => LIBELLES[field] ?? field)
}

/** Les pages ouvertes aux moteurs : toutes, sauf celles qui se déclarent « noindex ». */
function indexablePages(root: string): { file: string; source: string }[] {
  return pageFiles(root)
    .map((file) => ({ file, source: read(root, file) }))
    .filter(({ source }) => isIndexable(source))
    .sort((a, b) => pagePath(a.file).localeCompare(pagePath(b.file)))
}

/** `sitemap.xml` : chaque page ouverte aux moteurs, avec sa traduction et, pour un article, sa date. */
export function sitemap(root: string = process.cwd()): string {
  const urls = indexablePages(root).map(({ file, source }) => {
    const other = traduction(root, file, source)
    const versions = other ? ({ [langueDe(file)]: pageUrl(file), [langueDe(other)]: pageUrl(other) } as Record<Langue, string>) : null
    const date = isArticle(file) ? meta(source, 'vv:maj') || meta(source, 'vv:date') : ''
    return [
      '  <url>',
      `    <loc>${pageUrl(file)}</loc>`,
      ...(date ? [`    <lastmod>${date}</lastmod>`] : []),
      ...(versions ? (['fr', 'en'] as const).map((langue) => `    <xhtml:link rel="alternate" hreflang="${langue}" href="${versions[langue]}" />`) : []),
      '  </url>',
    ].join('\n')
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

/**
 * `llms.txt` : le site résumé pour un assistant (https://llmstxt.org). Son début est écrit à la
 * main (src/pages/llms.md) ; la liste des pages, avec le résumé de chacune, est tirée des pages.
 */
export function llmsTxt(root: string = process.cwd()): string {
  const pages = indexablePages(root)
  const line = ({ file, source }: { file: string; source: string }) =>
    `- [${isArticle(file) ? texte(heading(source)) : title(source).replace(/\s+[—|]\s+VisionViewer$/, '')}](${pageUrl(file)}): ${meta(source, 'description')}`
  const section = (name: string, keep: (file: string) => boolean) => {
    const lines = pages.filter(({ file }) => keep(file)).map(line)
    return lines.length ? `## ${name}\n\n${lines.join('\n')}\n` : ''
  }
  return [
    read(root, LLMS).trim() + '\n',
    section('Product (English)', (file) => langueDe(file) === 'en' && !isArticle(file)),
    section('Blog (English)', (file) => langueDe(file) === 'en' && isArticle(file)),
    section('Produit (français)', (file) => langueDe(file) === 'fr' && !isArticle(file)),
    section('Blog (français)', (file) => langueDe(file) === 'fr' && isArticle(file)),
  ]
    .filter(Boolean)
    .join('\n')
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
    // Le plan du site et le résumé pour les assistants, écrits avec les pages
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(root) })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsTxt(root) })
    },
    closeBundle() {
      if (!building) return
      building = false
      const missing = missingFields(root)
      if (missing.length) console.warn(`\n[pages légales] ${missing.length} mention(s) encore « À compléter » dans ${SOCIETE} :\n${missing.map((label) => `  - ${label}`).join('\n')}\n`)
    },
  }
}
