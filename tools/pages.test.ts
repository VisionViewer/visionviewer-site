import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE, isIndexable, langueDe, llmsTxt, pageInputs, pagePath, questions, renderPage, sitemap, traduction, type Langue } from './pages'

const root = process.cwd()
const files = Object.values(pageInputs(root))
const sources = new Map(files.map((file) => [file, readFileSync(join(root, file), 'utf8')]))
const rendered = new Map(files.map((file) => [file, renderPage(root, file, sources.get(file)!)]))
const rewrites = (JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] }).rewrites

/** Les liens d'une page vers une autre page du site : « /blog », « /cgu#objet »… */
const internalLinks = (html: string) =>
  [...html.matchAll(/<a [^>]*href="(\/[^"]*)"/g)].map(([, href]) => href.replace(/[#?].*$/, '')).filter((path) => !/\.\w+$/.test(path))

/** Le fichier que Vercel sert pour cette adresse, d'après les règles de vercel.json. */
function served(path: string): string | null {
  if (path === '/') return 'index.html'
  for (const { source, destination } of rewrites) {
    const pattern = new RegExp(`^${source.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`)
    const match = pattern.exec(path)
    if (match) return destination.replace(/:(\w+)/g, (_, name: string) => match.groups?.[name] ?? '').slice(1)
  }
  return null
}

const LEGALES = ['mentions-legales.html', 'confidentialite.html', 'cgu.html', 'cgv.html', 'sla.html', 'dpa.html']
const indexables = files.filter((file) => isIndexable(rendered.get(file)!))
const tag = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? ''
const structured = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json) as { '@graph': Record<string, unknown>[] })

describe('Pages du site', () => {
  it('ne gardent ni morceau à inclure, ni valeur à remplacer', () => {
    for (const [file, html] of rendered) {
      expect(html, file).not.toMatch(/<!--@/)
      expect(html, file).not.toMatch(/\{\{/)
    }
  })

  it('ne mènent qu’à des adresses que Vercel sait servir', () => {
    for (const [file, html] of rendered) {
      for (const path of internalLinks(html)) {
        const target = served(path)
        expect(target, `${file} → ${path} : aucune règle dans vercel.json`).not.toBeNull()
        expect(existsSync(join(root, target!)), `${file} → ${path} : ${target} n’existe pas`).toBe(true)
      }
    }
  })

  it('sont toutes servies à une adresse sans « .html »', () => {
    for (const file of files) expect(served(pagePath(file)), `${file} : ajouter sa règle à vercel.json`).toBe(file)
  })

  it('n’ont aucun script écrit dans la page : la politique de contenu (vercel.json) le refuserait en ligne', () => {
    for (const [file, html] of rendered) {
      // Seule exception : les données structurées, qui ne sont pas un script (rien ne s'exécute)
      for (const [script] of html.matchAll(/<script\b[^>]*>/g)) if (script !== '<script type="application/ld+json">') expect(script, file).toMatch(/\ssrc="/)
      expect(html, file).not.toMatch(/\son\w+="/)
    }
  })

  it('portent l’adresse de contact du site', () => {
    expect(rendered.get('index.html')).toContain('mailto:contact@visionviewer.net')
    expect(rendered.get('mentions-legales.html')).toContain('contact@visionviewer.net')
  })
})

describe('Référencement', () => {
  it('ouvre aux moteurs la présentation, la démo et le blog, dans les deux langues', () => {
    for (const file of ['index.html', 'en.html', 'demo.html', 'blog.html', 'en/blog.html']) expect(indexables, file).toContain(file)
    for (const file of files.filter((name) => /blog\/.+\.html$/.test(name))) expect(indexables, file).toContain(file)
  })

  it('garde les pages légales hors des moteurs tant que leurs mentions sont à compléter', () => {
    for (const file of LEGALES) expect(indexables, file).not.toContain(file)
  })

  it('donne à chaque page son adresse canonique, et une seule', () => {
    for (const [file, html] of rendered) {
      const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(([, href]) => href)
      expect(canonical, file).toEqual([SITE + pagePath(file)])
      expect([...html.matchAll(/<meta property="og:url"/g)], file).toHaveLength(1)
      expect([...html.matchAll(/<meta property="og:type"/g)], file).toHaveLength(1)
    }
  })

  it('donne à chaque page ouverte aux moteurs un titre et une description qui lui sont propres', () => {
    const titles = new Map<string, string>()
    const descriptions = new Map<string, string>()
    for (const file of indexables) {
      const html = rendered.get(file)!
      const title = tag(html, /<title>([\s\S]*?)<\/title>/)
      const description = tag(html, /<meta name="description" content="([^"]*)"/)
      expect(title.length, `${file} : titre « ${title} »`).toBeGreaterThan(20)
      expect(title.length, `${file} : titre trop long pour un résultat de recherche (${title.length})`).toBeLessThanOrEqual(90)
      expect(description.length, `${file} : description`).toBeGreaterThanOrEqual(110)
      expect(description.length, `${file} : description trop longue (${description.length})`).toBeLessThanOrEqual(170)
      expect(titles.get(title), `${file} : même titre que ${titles.get(title)}`).toBeUndefined()
      expect(descriptions.get(description), `${file} : même description que ${descriptions.get(description)}`).toBeUndefined()
      titles.set(title, file)
      descriptions.set(description, file)
      expect([...html.matchAll(/<h1[\s>]/g)], `${file} : un seul titre principal`).toHaveLength(file === 'demo.html' ? 0 : 1)
    }
  })

  it('dit sa langue, et relie chaque page à sa traduction, qui la relie en retour', () => {
    for (const file of files) {
      const html = rendered.get(file)!
      const langue = langueDe(file)
      expect(html, file).toContain(`<html lang="${langue}">`)
      const other = traduction(root, file, sources.get(file)!)
      if (!other) continue
      expect(traduction(root, other, sources.get(other)!), `${other} ne renvoie pas à ${file}`).toBe(file)
      const urls = { [langue]: SITE + pagePath(file), [langueDe(other)]: SITE + pagePath(other) } as Record<Langue, string>
      expect(html, file).toContain(`<link rel="alternate" hreflang="fr" href="${urls.fr}" />`)
      expect(html, file).toContain(`<link rel="alternate" hreflang="en" href="${urls.en}" />`)
    }
  })

  it('traduit chaque article du blog', () => {
    for (const file of files.filter((name) => /blog\/.+\.html$/.test(name))) expect(traduction(root, file, sources.get(file)!), `${file} : sa traduction (vv:traduction)`).not.toBeNull()
  })

  it('écrit des données structurées lisibles : l’éditeur, le produit, chaque article', () => {
    for (const file of ['index.html', 'en.html']) {
      const types = structured(rendered.get(file)!).flatMap((data) => data['@graph'].map((node) => node['@type']))
      expect(types, file).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']))
    }
    for (const file of files.filter((name) => /blog\/.+\.html$/.test(name))) {
      const graph = structured(rendered.get(file)!).flatMap((data) => data['@graph'])
      const post = graph.find((node) => node['@type'] === 'BlogPosting')
      expect(post, file).toMatchObject({ url: SITE + pagePath(file), inLanguage: langueDe(file) })
      expect(String(post?.headline).length, file).toBeGreaterThan(10)
      expect(graph.map((node) => node['@type']), file).toContain('BreadcrumbList')
    }
  })

  it('reprend dans les données structurées les questions affichées, et elles seules', () => {
    for (const file of files) {
      const html = rendered.get(file)!
      const asked = questions(file, sources.get(file)!)
      const faq = structured(html).flatMap((data) => data['@graph']).find((node) => node['@type'] === 'FAQPage') as { mainEntity: { name: string }[] } | undefined
      expect(faq?.mainEntity.length ?? 0, file).toBe(asked.length)
      expect([...html.matchAll(/\sdata-q\b/g)], file).toHaveLength(asked.length)
      for (const { question, answer } of asked) {
        expect(question.length, `${file} : « ${question} »`).toBeGreaterThan(8)
        expect(answer.length, `${file} : réponse à « ${question} »`).toBeGreaterThan(40)
      }
    }
    expect(questions('index.html', sources.get('index.html')!).length).toBe(questions('en.html', sources.get('en.html')!).length)
  })

  it('liste dans sitemap.xml les pages ouvertes aux moteurs, et aucune autre', () => {
    const listed = [...sitemap(root).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url).sort()
    expect(listed).toEqual(indexables.map((file) => SITE + pagePath(file)).sort())
    expect(readFileSync(join(root, 'public/robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  it('résume le site dans llms.txt, avec chaque page ouverte aux moteurs', () => {
    const text = llmsTxt(root)
    expect(text.startsWith('# VisionViewer\n')).toBe(true)
    for (const file of indexables) expect(text, file).toContain(`](${SITE + pagePath(file)})`)
    for (const file of LEGALES) expect(text, file).not.toContain(`](${SITE + pagePath(file)})`)
  })
})

describe('Blog', () => {
  for (const [langue, dir] of [
    ['fr', 'blog'],
    ['en', 'en/blog'],
  ] as const) {
    const blog = rendered.get(`${dir}.html`)!
    const articles = files.filter((file) => file.startsWith(`${dir}/`))

    it(`liste chaque article, avec son titre (${langue})`, () => {
      expect(articles.length).toBeGreaterThan(0)
      for (const file of articles) {
        const title = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(rendered.get(file)!)![1].trim()
        expect(blog).toContain(`href="/${file.replace(/\.html$/, '')}"`)
        expect(blog).toContain(title)
      }
    })

    it(`n’invente pas d’étude de cas : la rubrique dit « à venir » tant qu’elle est vide (${langue})`, () => {
      const section = blog.slice(blog.indexOf('id="etudes-de-cas"'))
      if (!section.includes('class="card"')) expect(section).toContain(langue === 'fr' ? 'À venir' : 'Coming soon')
    })
  }

  it('publie autant d’articles en anglais qu’en français', () => {
    expect(files.filter((file) => file.startsWith('en/blog/')).length).toBe(files.filter((file) => file.startsWith('blog/')).length)
  })
})
