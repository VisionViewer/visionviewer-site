import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CODES, DEFAUT, LANGUES, SITE, cle, isIndexable, langueDe, lieu, llmsTxt, pageInputs, pagePath, questions, renderPage, sitemap, versions, type Langue } from './pages'
import { appliquer, fichierServi, readRoutes, repondre } from './routes'

const root = process.cwd()
const files = Object.values(pageInputs(root))
const sources = new Map(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]))
const rendered = new Map(files.map((file) => [file, renderPage(root, file, sources.get(file)!)]))
const routes = readRoutes(root)

const source = (file: string) => sources.get(file)!
const html = (file: string) => rendered.get(file)!
const key = (file: string) => cle(file, source(file))
const same = (file: string) => versions(root, file, source(file))
const chemin = (file: string) => lieu(file).chemin
const autres = (langue: Langue) => CODES.filter((other) => other !== langue)

/** Les liens d'une page vers une autre page du site : leur chemin, sans ancre, et la langue qu'ils annoncent (`hreflang`). */
const internalLinks = (page: string) =>
  [...page.matchAll(/<a\s[^>]*href="(\/[^"]*)"[^>]*>/g)]
    .map(([tag, href]) => ({ path: href.replace(/[#?].*$/, ''), hreflang: /\shreflang="([^"]+)"/.exec(tag)?.[1] }))
    .filter(({ path }) => !/\.\w+$/.test(path))

/** Une adresse que vercel.json redirige, et où. Ses paramètres comptent : « /?demo ». */
const redirigee = (address: string) => {
  const url = new URL(address, SITE)
  return appliquer(routes.redirects, url.pathname, url.searchParams)
}
/** Le fichier qui sert une adresse (réécritures de vercel.json), s'il existe. */
function servie(path: string): string | null {
  const file = fichierServi(routes, path)
  return file && existsSync(join(root, file)) ? file : null
}
/** Les adresses du site que cite un texte (plan du site, llms.txt). */
const adresses = (text: string) => [...text.matchAll(new RegExp(`${SITE.replace(/\./g, '\\.')}(/[^"<)\\s]*)?`, 'g'))].map(([, path]) => (path ?? '/').replace(/[#?].*$/, ''))
/** Les adresses du site où mènent des données structurées. Un `@id` nomme une chose, il n'y mène pas : il ne compte pas. */
function liensDe(data: unknown): string[] {
  if (Array.isArray(data)) return data.flatMap(liensDe)
  if (!data || typeof data !== 'object') return []
  return Object.entries(data).flatMap(([name, value]) => (name.startsWith('@') ? [] : typeof value === 'string' ? (value.startsWith(SITE) ? adresses(value) : []) : liensDe(value)))
}

/** Les pages qui gardent leur « noindex » : les six pages légales, par leur clé, dans chaque langue. */
const LEGALES = ['legal-notice', 'privacy', 'terms-of-use', 'terms-of-sale', 'sla', 'dpa']
const articles = files.filter((file) => chemin(file).startsWith('blog/'))
const indexables = files.filter((file) => isIndexable(html(file)))
const tag = (page: string, pattern: RegExp) => pattern.exec(page)?.[1] ?? ''
const structured = (page: string) => [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json) as { '@graph': Record<string, unknown>[] })
const alternatesOf = (text: string) => [...text.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(([, hreflang, href]) => `${hreflang} ${href}`)

describe('Pages du site', () => {
  it('ne gardent ni morceau à inclure, ni valeur à remplacer', () => {
    for (const [file, page] of rendered) {
      expect(page, file).not.toMatch(/<!--@/)
      expect(page, file).not.toMatch(/\{\{/)
    }
  })

  it('vivent toutes sous le préfixe de leur langue : il n’y a rien à la racine', () => {
    const atRoot = readdirSync(root).filter((name) => name.endsWith('.html'))
    expect(atRoot.sort()).toEqual(CODES.map((langue) => `${langue}.html`).sort())
    for (const file of files) expect(pagePath(file) === `/${langueDe(file)}` || pagePath(file).startsWith(`/${langueDe(file)}/`), file).toBe(true)
  })

  it('sont toutes servies à une adresse sans « .html », que rien ne redirige', () => {
    for (const file of files) {
      expect(servie(pagePath(file)), `${file} : aucune réécriture de vercel.json ne sert ${pagePath(file)}`).toBe(file)
      expect(redirigee(pagePath(file)), `${file} : son adresse est redirigée`).toBeNull()
    }
  })

  it('ne mènent qu’à des pages qui existent, sans passer par une redirection', () => {
    for (const [file, page] of rendered) {
      for (const { path } of internalLinks(page)) {
        expect(redirigee(path), `${file} → ${path} : cette adresse redirige vers ${redirigee(path)?.vers} ; écrire le lien vers l’adresse finale`).toBeNull()
        expect(servie(path), `${file} → ${path} : aucune page à cette adresse`).not.toBeNull()
      }
    }
  })

  it('gardent tous leurs liens dans leur langue ; seul un lien de langue en sort', () => {
    for (const [file, page] of rendered) {
      const langue = langueDe(file)
      for (const { path, hreflang } of internalLinks(page)) {
        const target = servie(path)
        // Un lien qui ne mène nulle part est l'affaire du test précédent
        if (target) expect(langueDe(target), `${file} → ${path} : un lien ${hreflang ? `annoncé « ${hreflang} »` : `d’une page « ${langue} »`}`).toBe(hreflang ?? langue)
      }
    }
  })

  it('n’ont aucun script écrit dans la page : la politique de contenu (vercel.json) le refuserait en ligne', () => {
    for (const [file, page] of rendered) {
      // Seule exception : les données structurées, qui ne sont pas un script (rien ne s'exécute)
      for (const [script] of page.matchAll(/<script\b[^>]*>/g)) if (script !== '<script type="application/ld+json">') expect(script, file).toMatch(/\ssrc="/)
      expect(page, file).not.toMatch(/\son\w+="/)
    }
  })

  it('portent l’adresse de contact du site', () => {
    for (const langue of CODES) expect(html(`${langue}.html`), langue).toContain('mailto:contact@visionviewer.net')
  })
})

describe('Langues', () => {
  it('ont chacune leur présentation, leur blog, leur démo, leur en-tête et leur pied de page', () => {
    for (const langue of CODES) {
      for (const file of [`${langue}.html`, `${langue}/blog.html`, `${langue}/demo.html`]) expect(files, `${file} : cette page manque à la langue « ${langue} »`).toContain(file)
      for (const partial of ['header', 'footer']) expect(existsSync(join(root, `src/pages/partials/${partial}.${langue}.html`)), `${partial}.${langue}.html`).toBe(true)
    }
  })

  it('« / » mène à la langue par défaut, la première déclarée, par une redirection permanente', () => {
    expect(DEFAUT).toBe(CODES[0])
    expect(redirigee('/')).toMatchObject({ vers: `/${DEFAUT}`, regle: { permanent: true } })
  })

  it('s’écrivent dans la langue de la page : balise, dates, libellés', () => {
    for (const file of files) {
      const langue = langueDe(file)
      expect(html(file), file).toContain(`<html lang="${langue}">`)
      expect(html(file), file).toContain(`<meta property="og:locale" content="${LANGUES[langue].og}" />`)
    }
    for (const file of articles) {
      const langue = langueDe(file)
      const signature = tag(html(file), /<header class="doc__head">\s*<span class="mono">([\s\S]*?)<\/span>/)
      const date = new Intl.DateTimeFormat(LANGUES[langue].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${tag(source(file), /<meta name="vv:date" content="([^"]+)"/)}T00:00:00Z`))
      expect(signature, `${file} : la date de sa signature`).toContain(date)
      expect(signature, `${file} : le temps de lecture`).toContain(LANGUES[langue].lecture(tag(source(file), /<meta name="vv:lecture" content="([^"]+)"/)))
      expect(html(file), `${file} : le titre de son sommaire`).toContain(`<span class="mono">${LANGUES[langue].sommaire}</span>`)
    }
  })

  it('relient chaque page à ses traductions, qui la relient en retour', () => {
    for (const file of files) {
      const versionsOf = same(file)
      expect(versionsOf[langueDe(file)], file).toBe(file)
      for (const langue of autres(langueDe(file))) {
        const other = versionsOf[langue]
        if (other) expect(same(other)[langueDe(file)], `${other} ne renvoie pas à ${file}`).toBe(file)
      }
    }
  })

  it('ne donnent pas la même clé à deux pages d’une même langue', () => {
    for (const langue of CODES) {
      const keys = files.filter((file) => langueDe(file) === langue).map(key)
      expect(new Set(keys).size, `clés en double en « ${langue} » : ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`).toBe(keys.length)
    }
  })

  it('traduisent la présentation, le blog, la démo et chaque article', () => {
    for (const file of files.filter((name) => ['', 'blog', 'demo'].includes(chemin(name)) || articles.includes(name)))
      for (const langue of CODES) expect(same(file)[langue], `${file} n’existe pas en « ${langue} » (même clé : ${key(file)})`).toBeDefined()
  })

  it('montrent un lien de langue dans l’en-tête et le pied de page, vers la même page ; à défaut, vers l’accueil', () => {
    for (const file of files.filter((name) => chemin(name) !== 'demo')) {
      const langue = langueDe(file)
      for (const other of autres(langue)) {
        const target = pagePath(same(file)[other] ?? `${other}.html`)
        const links = [...html(file).matchAll(new RegExp(`<a href="([^"]+)" hreflang="${other}" lang="${other}" title="[^"]+">([^<]+)</a>`, 'g'))]
        expect(links.map(([, href]) => href), `${file} : ses liens vers « ${other} »`).toEqual([target, target])
        // Par son code dans l'en-tête, par son nom dans le pied de page
        expect(links.map(([, , label]) => label), file).toEqual([LANGUES[other].court, LANGUES[other].nom])
      }
    }
  })

  it('font l’aller-retour : le lien de langue d’une traduction ramène à la page de départ', () => {
    for (const file of files) {
      for (const other of autres(langueDe(file))) {
        const there = same(file)[other]
        if (there) expect(pagePath(same(there)[langueDe(file)]!), `${file} → ${there} → ?`).toBe(pagePath(file))
      }
    }
  })

  it('annoncent leurs traductions aux moteurs : une par langue, et x-default vers la langue par défaut', () => {
    for (const file of files) {
      const versionsOf = same(file)
      const langues = CODES.filter((langue) => versionsOf[langue])
      const fallback = versionsOf[DEFAUT]
      const expected = langues.length < 2 ? [] : [...langues.map((langue) => `${langue} ${SITE}${pagePath(versionsOf[langue]!)}`), ...(fallback ? [`x-default ${SITE}${pagePath(fallback)}`] : [])]
      expect(alternatesOf(html(file).replace(/<a\s[^>]*>/g, '')), file).toEqual(expected)
    }
  })
})

describe('Référencement', () => {
  it('ouvre aux moteurs la présentation, la démo, le blog et ses articles, dans chaque langue', () => {
    for (const file of files.filter((name) => ['', 'blog', 'demo'].includes(chemin(name)) || articles.includes(name))) expect(indexables, file).toContain(file)
  })

  it('garde les pages légales hors des moteurs, dans chaque langue', () => {
    const legales = files.filter((file) => LEGALES.includes(key(file)))
    expect(legales.length, 'les six pages légales, par langue où elles existent').toBeGreaterThanOrEqual(LEGALES.length)
    for (const file of legales) expect(indexables, file).not.toContain(file)
    expect(files.filter((file) => !indexables.includes(file)).sort(), 'rien d’autre n’est fermé aux moteurs').toEqual(legales.sort())
  })

  it('donne à chaque page son adresse canonique : la sienne, jamais celle de sa traduction', () => {
    for (const [file, page] of rendered) {
      const canonical = [...page.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(([, href]) => href)
      expect(canonical, file).toEqual([SITE + pagePath(file)])
      expect([...page.matchAll(/<meta property="og:url" content="([^"]+)"/g)].map(([, href]) => href), file).toEqual([SITE + pagePath(file)])
      expect([...page.matchAll(/<meta property="og:type"/g)], file).toHaveLength(1)
    }
  })

  it('donne à chaque page un titre et une description qui lui sont propres', () => {
    const titles = new Map<string, string>()
    const descriptions = new Map<string, string>()
    for (const file of files) {
      const page = html(file)
      const title = tag(page, /<title>([\s\S]*?)<\/title>/)
      const description = tag(page, /<meta name="description" content="([^"]*)"/)
      expect(title.length, `${file} : titre « ${title} »`).toBeGreaterThan(20)
      // Ces longueurs sont celles qu'un moteur affiche : elles ne valent que pour les pages qu'il garde
      if (indexables.includes(file)) {
        expect(title.length, `${file} : titre trop long pour un résultat de recherche (${title.length})`).toBeLessThanOrEqual(90)
        expect(description.length, `${file} : description`).toBeGreaterThanOrEqual(110)
        expect(description.length, `${file} : description trop longue (${description.length})`).toBeLessThanOrEqual(170)
      }
      expect(titles.get(title), `${file} : même titre que ${titles.get(title)}`).toBeUndefined()
      expect(descriptions.get(description), `${file} : même description que ${descriptions.get(description)}`).toBeUndefined()
      titles.set(title, file)
      descriptions.set(description, file)
      expect([...page.matchAll(/<h1[\s>]/g)], `${file} : un seul titre principal`).toHaveLength(chemin(file) === 'demo' ? 0 : 1)
    }
  })

  it('écrit des données structurées lisibles, dans la langue de la page : l’éditeur, le produit, chaque article', () => {
    for (const langue of CODES) {
      const graph = structured(html(`${langue}.html`)).flatMap((data) => data['@graph'])
      expect(graph.map((node) => node['@type']), langue).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']))
      expect(graph.find((node) => node['@type'] === 'SoftwareApplication'), langue).toMatchObject({ inLanguage: langue, url: `${SITE}/${langue}` })
      expect(graph.find((node) => node['@type'] === 'WebSite'), langue).toMatchObject({ inLanguage: CODES })
    }
    for (const file of articles) {
      const graph = structured(html(file)).flatMap((data) => data['@graph'])
      const post = graph.find((node) => node['@type'] === 'BlogPosting')
      expect(post, file).toMatchObject({ url: SITE + pagePath(file), inLanguage: langueDe(file) })
      expect(String(post?.headline).length, file).toBeGreaterThan(10)
      expect(graph.map((node) => node['@type']), file).toContain('BreadcrumbList')
    }
    for (const file of files) for (const faq of structured(html(file)).flatMap((data) => data['@graph']).filter((node) => node['@type'] === 'FAQPage')) expect(faq.inLanguage, file).toBe(langueDe(file))
  })

  it('reprend dans les données structurées les questions affichées, et elles seules', () => {
    for (const file of files) {
      const page = html(file)
      const asked = questions(file, source(file))
      const faq = structured(page).flatMap((data) => data['@graph']).find((node) => node['@type'] === 'FAQPage') as { mainEntity: { name: string }[] } | undefined
      expect(faq?.mainEntity.length ?? 0, file).toBe(asked.length)
      expect([...page.matchAll(/\sdata-q\b/g)], file).toHaveLength(asked.length)
      for (const { question, answer } of asked) {
        expect(question.length, `${file} : « ${question} »`).toBeGreaterThan(8)
        expect(answer.length, `${file} : réponse à « ${question} »`).toBeGreaterThan(40)
      }
      // Une page et ses traductions répondent aux mêmes questions
      for (const other of Object.values(same(file))) expect(questions(other, source(other)).length, `${file} et ${other}`).toBe(asked.length)
    }
  })

  it('liste dans sitemap.xml les pages ouvertes aux moteurs, et aucune autre', () => {
    const listed = [...sitemap(root).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url).sort()
    expect(listed).toEqual(indexables.map((file) => SITE + pagePath(file)).sort())
    expect(readFileSync(join(root, 'public/robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('donne dans sitemap.xml les mêmes traductions que dans l’en-tête de chaque page', () => {
    const entries = sitemap(root).split('<url>').slice(1)
    expect(entries).toHaveLength(indexables.length)
    for (const entry of entries) {
      const file = indexables.find((name) => SITE + pagePath(name) === tag(entry, /<loc>([^<]+)<\/loc>/))!
      expect(alternatesOf(entry), file).toEqual(alternatesOf(html(file).replace(/<a\s[^>]*>/g, '')))
      expect(alternatesOf(entry).some((line) => line.startsWith('x-default ')), `${file} : x-default`).toBe(Boolean(same(file)[DEFAUT]) && Object.keys(same(file)).length > 1)
    }
  })

  it('résume le site dans llms.txt : chaque page ouverte aux moteurs, la langue par défaut d’abord', () => {
    const text = llmsTxt(root)
    expect(text.startsWith('# VisionViewer\n')).toBe(true)
    for (const file of indexables) expect(text, file).toContain(`](${SITE + pagePath(file)})`)
    for (const file of files.filter((name) => !indexables.includes(name))) expect(text, file).not.toContain(`](${SITE + pagePath(file)})`)
    const sections = CODES.flatMap((langue) => [LANGUES[langue].llms.pages, LANGUES[langue].llms.blog]).map((name) => text.indexOf(`## ${name}`))
    expect(sections.every((at) => at > 0), 'une section de pages et une de blog par langue').toBe(true)
    expect(sections, 'dans l’ordre des langues déclarées').toEqual([...sections].sort((a, b) => a - b))
  })
})

describe('Redirections', () => {
  /** Les adresses du site tel qu'il était en ligne le 20 novembre 2026, le français à la racine. */
  const ANCIENNES = [
    '/',
    // Plus ancienne encore : avant d'avoir son adresse, la démo s'ouvrait par un paramètre
    '/?demo',
    '/blog',
    '/demo',
    '/mentions-legales',
    '/confidentialite',
    '/cgu',
    '/cgv',
    '/sla',
    '/dpa',
    '/blog/la-place-compte-avant-l-achat',
    '/blog/un-plan-de-salle-en-moins-d-une-seconde',
    '/blog/quelle-est-la-meilleure-place-au-cinema',
    '/blog/vue-depuis-le-siege-comparatif-des-solutions',
    '/blog/reservation-et-choix-de-la-place-au-cinema-en-france',
    '/blog/ajouter-une-vue-depuis-le-fauteuil-a-sa-billetterie',
  ]
  /** Celles qui n'ont pas bougé : l'anglais était déjà sous son préfixe. */
  const INCHANGEES = [
    '/en',
    '/en/blog',
    '/en/blog/reserved-seating-what-the-studies-say',
    '/en/blog/a-seat-map-in-under-a-second',
    '/en/blog/best-seat-in-a-movie-theater',
    '/en/blog/view-from-seat-software-compared',
    '/en/blog/online-booking-and-seat-choice-in-french-cinemas',
    '/en/blog/add-a-3d-seat-view-to-cinema-ticketing',
  ]

  it('chaque ancienne adresse mène, en un seul saut et pour de bon (308), à une page qui existe', () => {
    for (const old of ANCIENNES) {
      const hop = redirigee(old)
      expect(hop, `${old} : aucune redirection dans vercel.json`).not.toBeNull()
      expect(hop!.regle.permanent, `${old} : une redirection permanente (308)`).toBe(true)
      expect(servie(hop!.vers), `${old} → ${hop!.vers} : aucune page à cette adresse`).not.toBeNull()
      expect(redirigee(hop!.vers), `${old} → ${hop!.vers} : un second saut`).toBeNull()
    }
  })

  it('une ancienne adresse française mène à la même page, en français', () => {
    expect(redirigee('/?demo')!.vers).toBe('/fr/demo')
    for (const old of ANCIENNES.filter((path) => !path.startsWith('/?') && path !== '/')) expect(redirigee(old)!.vers, old).toBe(`/fr${old}`)
  })

  it('une adresse terminée par une barre mène à la même, sans barre', () => {
    const existe = (file: string) => existsSync(join(root, file))
    expect(routes.trailingSlash, 'vercel.json : trailingSlash').toBe(false)
    for (const langue of CODES) {
      expect(repondre(routes, `/${langue}/`, new URLSearchParams(), existe), `/${langue}/`).toEqual({ code: 308, vers: `/${langue}` })
      expect(repondre(routes, `/${langue}/blog/`, new URLSearchParams(), existe), `/${langue}/blog/`).toEqual({ code: 308, vers: `/${langue}/blog` })
      expect(repondre(routes, `/${langue}`, new URLSearchParams(), existe), `/${langue}`).toEqual({ fichier: `${langue}.html` })
    }
    // La racine, elle, n'a pas de barre à perdre : elle mène à la langue par défaut
    expect(repondre(routes, '/', new URLSearchParams(), existe)).toEqual({ code: 308, vers: `/${DEFAUT}` })
    expect(repondre(routes, '/', new URLSearchParams('demo'), existe)).toEqual({ code: 308, vers: '/fr/demo' })
    expect(repondre(routes, '/fr/nexistepas', new URLSearchParams(), existe)).toBeNull()
  })

  it('les adresses qui n’ont pas bougé répondent toujours, sans redirection', () => {
    for (const path of INCHANGEES) {
      expect(redirigee(path), path).toBeNull()
      expect(servie(path), path).not.toBeNull()
    }
  })

  it('aucune redirection ne mène à une autre redirection, ni ne dépend de qui demande', () => {
    for (const { source: from, destination } of routes.redirects) {
      expect(routes.redirects.some((other) => other.source === destination), `${from} → ${destination}`).toBe(false)
      expect(destination.startsWith('/'), `${from} : une redirection reste sur le site`).toBe(true)
    }
    // Ni l'adresse IP, ni la langue du navigateur, ni un cookie : la seule condition permise porte
    // sur l'adresse elle-même (un de ses paramètres), jamais sur qui la demande
    const config = readFileSync(join(root, 'vercel.json'), 'utf8')
    expect(config).not.toMatch(/"missing"\s*:/)
    expect([...config.matchAll(/"type"\s*:\s*"(\w+)"/g)].map(([, type]) => type).filter((type) => type !== 'query'), 'conditions sur l’hôte, un en-tête ou un cookie').toEqual([])
    for (const rule of routes.rewrites) expect(rule.has, `${rule.source} : une réécriture sans condition`).toBeUndefined()
  })

  it('rien de ce que lisent les moteurs ne cite une adresse redirigée : plan du site, llms.txt, données structurées', () => {
    const cited = [...adresses(sitemap(root)), ...adresses(llmsTxt(root)), ...files.flatMap((file) => liensDe(structured(html(file))))]
    expect(cited.length).toBeGreaterThan(files.length)
    for (const path of cited.filter((address) => !/\.\w+$/.test(address))) {
      expect(redirigee(path), `${path} est redirigée`).toBeNull()
      expect(servie(path), `${path} : aucune page à cette adresse`).not.toBeNull()
    }
  })

  it('aucun script n’écrit en dur une adresse redirigée : les liens se composent avec la langue de la page', () => {
    const scripts = (dir: string): string[] =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? scripts(`${dir}/${entry.name}`) : /\.(ts|tsx|js)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [`${dir}/${entry.name}`] : [],
      )
    const fixed = routes.redirects.map((rule) => rule.source).filter((from) => from !== '/' && !from.includes(':'))
    for (const file of scripts('src')) {
      const code = readFileSync(join(root, file), 'utf8')
      for (const from of fixed) expect(code, `${file} écrit « ${from} » en dur`).not.toMatch(new RegExp(`['"\`]${from}['"\`#?/]`))
    }
  })
})

describe('Blog', () => {
  for (const langue of CODES) {
    const page = html(`${langue}/blog.html`)
    const own = articles.filter((file) => langueDe(file) === langue)

    it(`liste chaque article, avec son titre (${langue})`, () => {
      expect(own.length).toBeGreaterThan(0)
      for (const file of own) {
        const title = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html(file))![1].trim()
        expect(page).toContain(`href="${pagePath(file)}"`)
        expect(page).toContain(title)
      }
    })

    it(`n’invente pas d’étude de cas : sa rubrique est un emplacement vide tant qu’il n’y en a pas (${langue})`, () => {
      const section = page.slice(page.indexOf('id="etudes-de-cas"'))
      if (!section.includes('class="card"')) expect(section).toContain('class="vide"')
    })
  }

  it('publie autant d’articles dans chaque langue', () => {
    for (const langue of CODES) expect(articles.filter((file) => langueDe(file) === langue).length, langue).toBe(articles.length / CODES.length)
  })
})
