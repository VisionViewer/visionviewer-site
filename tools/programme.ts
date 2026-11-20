/*
 * Le programme du blog : les articles écrits d'avance, et le jour où chacun paraît.
 *
 * Un article paraît le jour de sa date (`vv:date`), à Paris. Avant, le site construit l'ignore
 * (tools/pages.ts). Pour programmer un article : lui donner la date de sa parution, dans chaque
 * langue, puis l'envoyer sur `main` avec le reste. Chaque matin, `.github/workflows/publication.yml`
 * demande ce programme ; s'il y a un article du jour, il reconstruit le site sur Vercel, attend
 * qu'il soit en ligne, puis prévient les moteurs (IndexNow).
 *
 *   npm run programme                  le programme : ce qui est paru, ce qui paraîtra, et quand
 *   npm run programme -- --jour        les adresses des articles du jour, une par ligne
 *   npm run programme -- --jour 2026-11-24   celles d'un autre jour
 *
 * Il se lance avec Node, qui exécute ce fichier tel quel ; d'où l'absence de tout import d'un
 * autre outil. Les langues sont les dossiers qui ont un blog (`fr/blog`, `en/blog`) : elles se
 * déclarent dans tools/pages.ts, pas ici.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** L'adresse du site en ligne : la même que dans tools/pages.ts (un test le vérifie). */
export const SITE = 'https://visionviewer.net'

/** Aujourd'hui à Paris, « 2026-11-21 » : le même calcul que dans tools/pages.ts. */
export const jourDeParis = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(date)

export interface Parution {
  /** « 2026-11-21 » */
  date: string
  langue: string
  url: string
}

/** Tous les articles, de chaque langue, avec leur date ; les plus anciens d'abord. */
export function parutions(root: string = process.cwd()): Parution[] {
  const langues = readdirSync(root).filter((name) => existsSync(join(root, `${name}.html`)) && existsSync(join(root, name, 'blog')) && statSync(join(root, name, 'blog')).isDirectory())
  return langues
    .flatMap((langue) =>
      readdirSync(join(root, langue, 'blog'))
        .filter((file) => file.endsWith('.html'))
        .map((file) => {
          const date = /<meta\s+name="vv:date"\s+content="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(join(root, langue, 'blog', file), 'utf8'))?.[1]
          if (!date) throw new Error(`${langue}/blog/${file} : l'article n'a pas de date (vv:date).`)
          return { date, langue, url: `${SITE}/${langue}/blog/${file.replace(/\.html$/, '')}` }
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.langue.localeCompare(b.langue) || a.url.localeCompare(b.url))
}

/** Les adresses à annoncer le jour d'une parution : les articles du jour, et le blog de leur langue. */
export function duJour(jour: string, root: string = process.cwd()): string[] {
  const parus = parutions(root).filter((parution) => parution.date === jour)
  return [...parus.map(({ url }) => url), ...new Set(parus.map(({ langue }) => `${SITE}/${langue}/blog`))]
}

function main(args: string[]): void {
  const at = args.indexOf('--jour')
  if (at >= 0) {
    for (const url of duJour(args[at + 1] ?? jourDeParis())) console.log(url)
    return
  }
  const today = jourDeParis()
  const all = parutions()
  const days = [...new Set(all.map(({ date }) => date))]
  for (const day of days) {
    const etat = day < today ? 'paru      ' : day === today ? 'aujourd’hui' : 'programmé '
    for (const { langue, url } of all.filter(({ date }) => date === day)) console.log(`${day}  ${etat}  ${langue}  ${url.slice(SITE.length)}`)
  }
  const next = days.filter((day) => day > today)
  console.log(next.length ? `\n${next.length} jour(s) de parution à venir, jusqu’au ${next.at(-1)}.` : '\nRien de programmé.')
}

// Lancé comme une commande, et non importé par un test
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
