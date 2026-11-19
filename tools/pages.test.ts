import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pageInputs, renderPage } from './pages'

const root = process.cwd()
const files = Object.values(pageInputs(root))
const rendered = new Map(files.map((file) => [file, renderPage(root, file, readFileSync(join(root, file), 'utf8'))]))
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
    for (const file of files) {
      const path = file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`
      expect(served(path), `${file} : ajouter sa règle à vercel.json`).toBe(file)
    }
  })

  it('n’ont aucun script écrit dans la page : la politique de contenu (vercel.json) le refuserait en ligne', () => {
    for (const [file, html] of rendered) {
      for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) expect(tag, file).toMatch(/\ssrc="/)
      expect(html, file).not.toMatch(/\son\w+="/)
    }
  })

  it('portent l’adresse de contact du site', () => {
    expect(rendered.get('index.html')).toContain('mailto:contact@visionviewer.net')
    expect(rendered.get('mentions-legales.html')).toContain('contact@visionviewer.net')
  })
})

describe('Blog', () => {
  const blog = rendered.get('blog.html')!
  const articles = files.filter((file) => file.startsWith('blog/'))

  it('liste chaque article, avec son titre', () => {
    expect(articles.length).toBeGreaterThan(0)
    for (const file of articles) {
      const title = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(rendered.get(file)!)![1].trim()
      expect(blog).toContain(`href="/${file.replace(/\.html$/, '')}"`)
      expect(blog).toContain(title)
    }
  })

  it('n’invente pas d’étude de cas : la rubrique dit « à venir » tant qu’elle est vide', () => {
    const section = blog.slice(blog.indexOf('id="etudes-de-cas"'))
    if (!section.includes('class="card"')) expect(section).toContain('À venir')
  })
})
