/*
 * Les pages du site : la présentation, la démo, le blog et ses articles, les pages légales, dans
 * chaque langue du site.
 *
 * Une langue vit sous son préfixe : `fr.html` (sa présentation, à l'adresse `/fr`) et le dossier
 * `fr/` (`fr/blog.html`, `fr/blog/*.html`, `fr/demo.html`…). Il n'y a rien à la racine : `/`
 * redirige vers la langue par défaut (vercel.json). **Les langues se déclarent ici, dans `LANGUES`,
 * et nulle part ailleurs** : aucune n'a de cas particulier dans ce fichier.
 *
 * Ce sont des fichiers HTML ordinaires. Ce module leur donne ce qu'elles ont en commun, à la
 * construction comme en développement, sans rien charger dans le navigateur :
 *
 *   <!--@include nom-->      le morceau `src/pages/partials/nom.<langue>.html` (en-tête, pied de
 *                            page…) ; à défaut `nom.html`, commun à toutes les langues
 *   <!--@langues-->          les liens vers la même page dans les autres langues (à défaut, vers
 *                            leur accueil) ; `<!--@langues court-->` les écrit par leur code
 *   <!--@sommaire-->         le sommaire de la page : un lien par section (<h2 id="…">)
 *   {{contact}}, {{societe.siege}}…   les valeurs de `src/pages/societe.json`
 *   <!--@articles rubrique | texte si vide-->   la liste des articles d'une rubrique du blog
 *   <!--@voir-aussi-->       dans un article : les autres articles de sa langue
 *   <!--@faq-->…<!--@/faq--> des questions (`data-q`) et leurs réponses (`data-a`), reprises
 *                            dans les données structurées de la page
 *
 * Deux pages sont la même page, dans deux langues, quand elles ont la même clé : leur chemin dans
 * leur langue (`blog`, `demo`, `sla`), ou `<meta name="vv:page" content="…">` quand le nom du
 * fichier change avec la langue (un article, `mentions-legales` et `legal-notice`).
 *
 * Il écrit aussi ce qui sert à être trouvé, par un moteur de recherche comme par un assistant :
 * dans l'en-tête de chaque page, son adresse canonique (elle-même, jamais sa traduction), ses
 * traductions (`hreflang`) et ses données structurées (schema.org) ; à la construction,
 * `sitemap.xml` et `llms.txt`.
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

/** Les rubriques du blog, et l'ordre de leurs sections */
type Rubrique = 'enquete' | 'guide' | 'article' | 'etude-de-cas'

/** Ce qu'une langue apporte : son nom, ses formats, et tout ce que l'outil écrit lui-même dans une page. */
interface Textes {
  /** Son nom, dans cette langue : le lien de langue du pied de page */
  nom: string
  /** Son code, tel qu'il s'affiche : le lien de langue de l'en-tête */
  court: string
  /** L'infobulle du lien qui mène à cette langue */
  version: string
  /** Pour les dates : « 19 novembre 2026 », « November 19, 2026 » */
  locale: string
  /** `og:locale` */
  og: string
  /** Le nom que porte un article de chaque rubrique */
  rubriques: Record<Rubrique, string>
  lecture: (minutes: string) => string
  lire: string
  sommaire: string
  voirAussi: string
  /** Ce qui s'affiche à la place d'une mention de la société encore inconnue, et le nom de chaque mention */
  aCompleter: string
  mentions: Record<string, string>
  /** Ce que VisionViewer est, en une phrase : la description de l'éditeur et du produit */
  produit: string
  /** Les titres de ses deux sections dans `llms.txt` */
  llms: { pages: string; blog: string }
}

/**
 * Les langues du site. **C'est ici, et ici seulement, qu'une langue se déclare.** La première est
 * la langue par défaut : `/` y mène, `x-default` la désigne, et elle vient d'abord dans `llms.txt`.
 * Ce qu'une langue nouvelle demande d'autre est du contenu : voir « Ajouter une langue » dans
 * site/README.md.
 */
export const LANGUES = {
  en: {
    nom: 'English',
    court: 'EN',
    version: 'English version',
    locale: 'en-US',
    og: 'en_US',
    rubriques: { enquete: 'Research', guide: 'Guide', article: 'Article', 'etude-de-cas': 'Case study' },
    lecture: (minutes) => `${minutes} min read`,
    lire: 'Read the article',
    sommaire: 'Contents',
    voirAussi: 'Read next',
    aCompleter: 'To be completed',
    mentions: {
      capital: 'share capital',
      siege: 'registered office address',
      rcs: 'registration number and city (RCS)',
      tva: 'EU VAT number',
      directeur: 'name of the publication director',
      telephone: 'phone number',
      hebergeurTelephone: 'hosting provider’s phone number',
    },
    produit:
      'VisionViewer shows every moviegoer the view from their seat, in 3D, before they pay. Each auditorium is modeled to its real dimensions; the view plugs into the cinema’s website and mobile app, with no change of ticketing system.',
    llms: { pages: 'Product (English)', blog: 'Blog (English)' },
  },
  fr: {
    nom: 'Français',
    court: 'FR',
    version: 'Version française',
    locale: 'fr-FR',
    og: 'fr_FR',
    rubriques: { enquete: 'Enquête', guide: 'Guide', article: 'Article', 'etude-de-cas': 'Étude de cas' },
    lecture: (minutes) => `${minutes} min de lecture`,
    lire: 'Lire l’article',
    sommaire: 'Sommaire',
    voirAussi: 'À lire aussi',
    aCompleter: 'À compléter',
    mentions: {
      capital: 'montant du capital social',
      siege: 'adresse du siège social',
      rcs: 'numéro et ville d’immatriculation au RCS',
      tva: 'numéro de TVA intracommunautaire',
      directeur: 'nom du directeur de la publication',
      telephone: 'numéro de téléphone',
      hebergeurTelephone: 'numéro de téléphone de l’hébergeur',
    },
    produit:
      'VisionViewer montre à chaque spectateur la vue depuis sa place de cinéma, en 3D, avant le paiement. Chaque salle est modélisée à ses propres cotes ; la vue s’ajoute au site web et à l’application mobile du cinéma, sans changer de billetterie.',
    llms: { pages: 'Produit (français)', blog: 'Blog (français)' },
  },
} satisfies Record<string, Textes>

export type Langue = keyof typeof LANGUES
/** Les codes des langues, dans l'ordre de leur déclaration */
export const CODES = Object.keys(LANGUES) as Langue[]
/** La langue par défaut : la première déclarée. */
export const DEFAUT: Langue = CODES[0]
const textes = (langue: Langue): Textes => LANGUES[langue]

/**
 * Ce que les mentions légales doivent dire de la société. `null` : pas encore connu. Une valeur
 * qui se traduit (la forme de la société) s'écrit par langue : `{ "fr": "…", "en": "…" }`.
 */
type Societe = Record<string, string | null | Partial<Record<Langue, string>>>

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

/** Où est une page : sa langue, et son chemin dans cette langue (« » pour sa présentation, « blog », « blog/mon-article »). */
export function lieu(file: string): { langue: Langue; chemin: string } {
  const match = /^([^/.]+)(?:\/(.+))?\.html$/.exec(file)
  if (!match || !(match[1] in LANGUES)) throw new Error(`${file} : une page vit sous le préfixe de sa langue (${CODES.map((code) => `${code}.html, ${code}/…`).join(' ; ')}).`)
  return { langue: match[1] as Langue, chemin: match[2] ?? '' }
}
/** Le fichier d'une page : `fr.html` pour la présentation, `fr/blog.html`, `fr/blog/mon-article.html`. */
const fichier = (langue: Langue, chemin: string) => (chemin ? `${langue}/${chemin}.html` : `${langue}.html`)
export const langueDe = (file: string): Langue => lieu(file).langue
const accueil = (langue: Langue) => fichier(langue, '')
const blog = (langue: Langue) => fichier(langue, 'blog')
/** La présentation d'une langue : la page qui porte la scène 3D. */
export const isAccueil = (file: string) => lieu(file).chemin === ''
const isArticle = (file: string) => /^blog\/[^/]+$/.test(lieu(file).chemin)

/** L'adresse d'une page, sans « .html » : « /fr », « /fr/blog », « /en/blog/mon-article ». */
export const pagePath = (file: string) => `/${file.replace(/\.html$/, '')}`
const pageUrl = (file: string) => SITE + pagePath(file)

/** « 19 novembre 2026 », « November 19, 2026 » */
const longDate = (day: string, langue: Langue) =>
  new Intl.DateTimeFormat(textes(langue).locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))

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

/** Les pages d'une langue : sa présentation, les pages de son dossier, les articles de son blog. */
function pagesOf(root: string, langue: Langue): string[] {
  const html = (dir: string) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir))
          .filter((file) => file.endsWith('.html'))
          .map((file) => `${dir}/${file}`)
      : []
  return [...(existsSync(join(root, accueil(langue))) ? [accueil(langue)] : []), ...html(langue), ...html(`${langue}/blog`)]
}

/** Toutes les pages du site, langue après langue. */
const pageFiles = (root: string): string[] => CODES.flatMap((langue) => pagesOf(root, langue))

/** Les entrées de la construction : une par page, nommée d'après son chemin. */
export function pageInputs(root: string = process.cwd()): Record<string, string> {
  return Object.fromEntries(pageFiles(root).map((file) => [file.replace(/\.html$/, '').replace(/\//g, '-'), file]))
}

/**
 * Ce qui relie une page à ses traductions : la même clé dans chaque langue. Par défaut, son chemin
 * dans sa langue ; `vv:page` quand le nom du fichier change avec la langue.
 */
export const cle = (file: string, source: string) => meta(source, 'vv:page') || lieu(file).chemin

/**
 * Les versions d'une page : son fichier dans chaque langue où elle existe, elle-même comprise.
 * Une page sans traduction n'a qu'une version : la sienne.
 */
export function versions(root: string, file: string, source: string): Partial<Record<Langue, string>> {
  const key = cle(file, source)
  const found: Partial<Record<Langue, string>> = {}
  for (const langue of CODES) {
    const same = pagesOf(root, langue).filter((other) => cle(other, other === file ? source : read(root, other)) === key)
    if (same.length > 1) throw new Error(`${same.join(' et ')} : deux pages de la même langue ont la même clé « ${key} » (vv:page).`)
    if (same.length) found[langue] = same[0]
  }
  return found
}

/** Ce que chaque article d'une langue dit de lui-même, dans son en-tête ; les plus récents d'abord. */
function articles(root: string, langue: Langue): Article[] {
  return pagesOf(root, langue)
    .filter(isArticle)
    .map((file) => {
      const html = read(root, file)
      const article: Article = {
        href: pagePath(file),
        rubrique: meta(html, 'vv:rubrique'),
        date: meta(html, 'vv:date'),
        maj: meta(html, 'vv:maj'),
        lecture: meta(html, 'vv:lecture'),
        title: heading(html),
        summary: meta(html, 'description'),
      }
      const day = /^\d{4}-\d{2}-\d{2}$/
      if (!(article.rubrique in textes(langue).rubriques) || !day.test(article.date) || (article.maj && !day.test(article.maj)) || !article.title || !article.summary)
        throw new Error(`${file} : il manque à l'article sa rubrique (vv:rubrique), sa date (vv:date), son titre (<h1>) ou son résumé (description).`)
      return article
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.href.localeCompare(b.href))
}

const byline = (article: Pick<Article, 'rubrique' | 'date' | 'lecture'>, langue: Langue) =>
  `${textes(langue).rubriques[article.rubrique as Rubrique]} · ${longDate(article.date, langue)}${article.lecture ? ` · ${textes(langue).lecture(article.lecture)}` : ''}`

const card = (article: Article, langue: Langue) => `<a class="card" href="${article.href}">
  <span class="mono">${byline(article, langue)}</span>
  <h3>${article.title}</h3>
  <p>${article.summary}</p>
  <span class="card__go">${textes(langue).lire}<span aria-hidden="true">→</span></span>
</a>`

/**
 * Les liens de langue d'une page : un par autre langue, vers la même page dans cette langue ; à
 * défaut, vers la présentation de cette langue. `court` : par leur code (« EN »), pour l'en-tête.
 */
function liensDeLangue(root: string, file: string, same: Partial<Record<Langue, string>>, court: boolean): string {
  return CODES.filter((langue) => langue !== langueDe(file))
    .map((langue) => {
      const target = same[langue] ?? accueil(langue)
      if (!existsSync(join(root, target))) throw new Error(`${file} : la langue « ${langue} » est déclarée, mais sa présentation (${accueil(langue)}) n'existe pas.`)
      return `<a href="${pagePath(target)}" hreflang="${langue}" lang="${langue}" title="${textes(langue).version}">${court ? textes(langue).court : textes(langue).nom}</a>`
    })
    .join('\n')
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
 * Les traductions d'une page, telles qu'un moteur les lit : une ligne par langue où elle existe
 * (elle-même comprise), et `x-default` vers sa version dans la langue par défaut. Rien pour une
 * page qui n'existe que dans une langue. Les mêmes lignes vont dans l'en-tête et dans le plan du site.
 */
function alternates(same: Partial<Record<Langue, string>>): { hreflang: string; href: string }[] {
  const langues = CODES.filter((langue) => same[langue])
  if (langues.length < 2) return []
  const fallback = same[DEFAUT]
  return [...langues.map((langue) => ({ hreflang: langue as string, href: pageUrl(same[langue]!) })), ...(fallback ? [{ hreflang: 'x-default', href: pageUrl(fallback) }] : [])]
}

/**
 * Ce qui sert à être trouvé, posé à la fin de l'en-tête : l'adresse canonique de la page (la
 * sienne), ses traductions, et ses données structurées (qui édite le site, ce qu'est le produit,
 * de quoi parle un article, les questions auxquelles la page répond).
 */
function referencement(file: string, source: string, html: string, societe: Societe, same: Partial<Record<Langue, string>>, faq: { question: string; answer: string }[]): string {
  const langue = langueDe(file)
  const url = pageUrl(file)
  const text = textes(langue)
  const article = isArticle(file)
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="${article ? 'article' : 'website'}" />`,
    `<meta property="og:locale" content="${text.og}" />`,
    ...CODES.filter((other) => other !== langue && same[other]).map((other) => `<meta property="og:locale:alternate" content="${textes(other).og}" />`),
    ...alternates(same).map(({ hreflang, href }) => `<link rel="alternate" hreflang="${hreflang}" href="${href}" />`),
  ]
  if (!isIndexable(html)) return tags.join('\n')

  const home = pageUrl(accueil(langue))
  const organisation = {
    '@type': 'Organization',
    '@id': ORGANISATION,
    name: 'VisionViewer',
    url: home,
    logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
    email: societe.contact,
    description: text.produit,
  }
  const graph: unknown[] = []
  const crumbs = (...steps: [name: string, file: string][]) => ({
    '@type': 'BreadcrumbList',
    itemListElement: steps.map(([name, target], i) => ({ '@type': 'ListItem', position: i + 1, name, item: pageUrl(target) })),
  })

  if (isAccueil(file)) {
    graph.push(
      organisation,
      { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'VisionViewer', url: home, inLanguage: CODES, publisher: { '@id': ORGANISATION } },
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
        articleSection: text.rubriques[meta(source, 'vv:rubrique') as Rubrique],
        image: IMAGE,
        url,
        mainEntityOfPage: url,
        author: { '@id': ORGANISATION },
        publisher: { '@id': ORGANISATION },
      },
      crumbs(['VisionViewer', accueil(langue)], ['Blog', blog(langue)], [texte(heading(html)), file]),
    )
  } else if (file === blog(langue)) {
    graph.push(organisation, crumbs(['VisionViewer', accueil(langue)], ['Blog', file]))
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

/** Applique à une page ses morceaux communs, ses liens de langue, les valeurs de la société, les listes d'articles et son référencement. */
export function renderPage(root: string, file: string, source: string): string {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  const langue = langueDe(file)
  const text = textes(langue)
  const same = versions(root, file, source)
  const fail = (message: string): never => {
    throw new Error(`${file} : ${message}`)
  }

  // Un morceau commun : celui de la langue de la page, à défaut celui qui vaut pour toutes
  let html = source.replace(/<!--@include ([\w-]+)-->/g, (_, name: string) => {
    const found = [`${PARTIALS}/${name}.${langue}.html`, `${PARTIALS}/${name}.html`].find((partial) => existsSync(join(root, partial)))
    return read(root, found ?? fail(`le morceau « ${name} » n'existe ni pour la langue « ${langue} » (${name}.${langue}.html), ni pour toutes (${name}.html).`)).trim()
  })

  // Les liens de langue, dans l'en-tête (par code) et le pied de page (par nom)
  html = html.replace(/<!--@langues( court)?-->/g, (_, court?: string) => liensDeLangue(root, file, same, Boolean(court)))

  // Le sommaire d'une page : un lien par titre de section (<h2 id="…">)
  html = html.replace('<!--@sommaire-->', () => {
    const titles = [...html.matchAll(/<h2 id="([\w-]+)">([\s\S]*?)<\/h2>/g)]
    if (titles.length === 0) fail('un sommaire est demandé, mais aucune section n’a d’identifiant (<h2 id="…">).')
    return `<nav class="sommaire" aria-label="${text.sommaire}">\n<span class="mono">${text.sommaire}</span>\n${titles.map(([, id, heading]) => `<a href="#${id}">${heading.trim()}</a>`).join('\n')}\n</nav>`
  })

  // Dans le menu du haut, le lien de la rubrique où l'on se trouve est marqué
  const blogPath = pagePath(blog(langue))
  if (file === blog(langue) || isArticle(file)) html = html.replace(`<a href="${blogPath}">Blog</a>`, `<a href="${blogPath}" aria-current="page">Blog</a>`)

  const all = /<!--@(articles |voir-aussi)/.test(html) ? articles(root, langue) : []
  html = html.replace(/<!--@articles ([\w-]+)(?: \| ([^>]*?))?-->/g, (_, rubrique: string, empty = '') => {
    if (!(rubrique in text.rubriques)) fail(`rubrique inconnue « ${rubrique} ».`)
    const list = all.filter((article) => article.rubrique === rubrique)
    return list.length ? `<div class="cards">${list.map((article) => card(article, langue)).join('\n')}</div>` : `<p class="vide">${empty}</p>`
  })

  // Au bas d'un article : les autres articles de sa langue, les plus récents d'abord
  html = html.replace('<!--@voir-aussi-->', () => {
    const others = all.filter((article) => article.href !== pagePath(file)).slice(0, 3)
    return others.length ? `<section class="voir-aussi">\n<h2>${text.voirAussi}</h2>\n<div class="cards">${others.map((article) => card(article, langue)).join('\n')}</div>\n</section>` : ''
  })

  const self = isArticle(file) ? { rubrique: meta(source, 'vv:rubrique'), date: meta(source, 'vv:date'), lecture: meta(source, 'vv:lecture') } : null

  html = html.replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => {
    if (key === 'contact') return (societe.contact as string | null) ?? fail('adresse de contact absente de societe.json.')
    if (key === 'annee') return String(new Date().getUTCFullYear())
    if (key === 'version') return longDate((societe.version as string | null) ?? fail('date de version absente de societe.json.'), langue)
    if (key === 'article.signature' && self) return byline(self, langue)
    if (key.startsWith('societe.')) {
      const field = key.slice('societe.'.length)
      if (!(field in societe)) fail(`« ${key} » n'existe pas dans societe.json.`)
      const value = societe[field]
      if (value === null) return `<span class="todo">${text.aCompleter} : ${text.mentions[field] ?? field}</span>`
      // Une valeur qui se traduit est écrite par langue
      return typeof value === 'string' ? value : (value[langue] ?? fail(`« ${key} » n'est pas traduit en « ${langue} » dans societe.json.`))
    }
    return fail(`valeur inconnue « {{${key}}} ».`)
  })

  // Les questions restent dans la page telles qu'elles sont écrites ; lues, leurs repères s'effacent
  const faq = questions(file, html)
  html = html.replace(/<!--@\/?faq-->/g, '')

  if (!html.includes('</head>')) fail('la page n’a pas d’en-tête (</head>).')
  return html.replace('</head>', () => `${referencement(file, source, html, societe, same, faq)}\n</head>`)
}

/** Ce que `societe.json` ne dit pas encore : à renseigner avant de publier les pages légales. */
export function missingFields(root: string = process.cwd()): string[] {
  const societe = JSON.parse(read(root, SOCIETE)) as Societe
  return Object.keys(societe).filter((field) => societe[field] === null)
}

/** Les pages ouvertes aux moteurs : toutes, sauf celles qui se déclarent « noindex ». */
function indexablePages(root: string): { file: string; source: string }[] {
  return pageFiles(root)
    .map((file) => ({ file, source: read(root, file) }))
    .filter(({ source }) => isIndexable(source))
}

/** `sitemap.xml` : chaque page ouverte aux moteurs, avec ses traductions et, pour un article, sa date. */
export function sitemap(root: string = process.cwd()): string {
  const urls = indexablePages(root)
    .sort((a, b) => pagePath(a.file).localeCompare(pagePath(b.file)))
    .map(({ file, source }) => {
      const date = isArticle(file) ? meta(source, 'vv:maj') || meta(source, 'vv:date') : ''
      return [
        '  <url>',
        `    <loc>${pageUrl(file)}</loc>`,
        ...(date ? [`    <lastmod>${date}</lastmod>`] : []),
        ...alternates(versions(root, file, source)).map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`),
        '  </url>',
      ].join('\n')
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

/**
 * `llms.txt` : le site résumé pour un assistant (https://llmstxt.org). Son début est écrit à la
 * main (src/pages/llms.md) ; la liste des pages, avec le résumé de chacune, est tirée des pages,
 * langue après langue, la langue par défaut d'abord.
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
    ...CODES.flatMap((langue) => [
      section(textes(langue).llms.pages, (file) => langueDe(file) === langue && !isArticle(file)),
      section(textes(langue).llms.blog, (file) => langueDe(file) === langue && isArticle(file)),
    ]),
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
      if (missing.length) console.warn(`\n[pages légales] ${missing.length} mention(s) de la société encore à compléter dans ${SOCIETE} : ${missing.join(', ')}.\n`)
    },
  }
}
