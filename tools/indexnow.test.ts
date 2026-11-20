import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KEY, KEY_URL, SITE, demande, urlsDe } from './indexnow'
import { SITE as SITE_DES_PAGES, sitemap } from './pages'
import { fichierServi, readRoutes } from './routes'

const root = process.cwd()

describe('IndexNow', () => {
  it('a une clé au format du protocole, publiée telle quelle à la racine du site', () => {
    expect(KEY).toMatch(/^[A-Za-z0-9-]{8,128}$/)
    expect(KEY_URL).toBe(`${SITE}/${KEY}.txt`)
    expect(existsSync(join(root, 'public', `${KEY}.txt`)), `public/${KEY}.txt`).toBe(true)
    expect(readFileSync(join(root, 'public', `${KEY}.txt`), 'utf8')).toBe(KEY)
  })

  it('n’a qu’une clé : pas de fichier de clé oublié dans public/', () => {
    const keys = readdirSync(join(root, 'public')).filter((name) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(name) && name !== 'robots.txt')
    expect(keys).toEqual([`${KEY}.txt`])
  })

  it('sert le fichier de la clé tel quel : aucune règle de vercel.json ne le détourne', () => {
    const rewritten = fichierServi(readRoutes(root), `/${KEY}.txt`)
    expect(rewritten === null || !existsSync(join(root, rewritten)), `/${KEY}.txt serait réécrit vers ${rewritten}`).toBe(true)
  })

  it('annonce les adresses du plan du site, sur le site et lui seul', () => {
    expect(SITE).toBe(SITE_DES_PAGES)
    const urls = urlsDe(sitemap(root))
    expect(urls.length).toBeGreaterThan(10)
    const body = demande(urls)
    expect(body).toMatchObject({ host: 'visionviewer.net', key: KEY, keyLocation: KEY_URL })
    expect(body.urlList).toEqual(urls)
    for (const url of body.urlList) expect(url.startsWith(`${SITE}/`), url).toBe(true)
  })

  it('refuse ce que le protocole refuserait', () => {
    expect(() => demande([])).toThrow(/Aucune adresse/)
    expect(() => demande(['https://exemple.fr/page'])).toThrow(/ne sont pas celles du site/)
    expect(() => demande([`${SITE}.pirate.fr/page`])).toThrow(/ne sont pas celles du site/)
    expect(demande([`${SITE}/en`, `${SITE}/en`]).urlList).toEqual([`${SITE}/en`])
  })
})
