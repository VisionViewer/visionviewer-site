/*
 * IndexNow : prévenir les moteurs de recherche que des pages du site ont changé, sans attendre
 * leur passage. Bing l'écoute, et partage ce qu'il reçoit avec les autres moteurs du protocole
 * (https://www.indexnow.org). Google ne l'écoute pas : pour lui, c'est le plan du site.
 *
 * À lancer après une mise en ligne, une fois le site vérifié en ligne :
 *
 *   npm run indexnow                 toutes les pages du plan du site en ligne
 *   npm run indexnow -- <adresse>…   seulement celles-ci (une page ajoutée, modifiée ou retirée)
 *   npm run indexnow -- --essai      montre ce qui partirait, sans rien envoyer
 *
 * **La clé n'est pas un secret.** Le protocole veut qu'elle soit publiée à la racine du site
 * (`public/<clé>.txt`, servi à `/<clé>.txt`) : c'est ce fichier qui prouve que la demande vient
 * bien du site. Elle est donc écrite ici, et dans le dépôt. La changer : un nouveau fichier dans
 * `public/`, la nouvelle valeur ci-dessous, puis une mise en ligne.
 *
 * Le script ne lit que ce qui est en ligne (le plan du site, le fichier de la clé) : il n'annonce
 * jamais une page qui n'est pas encore publiée. Il se lance avec Node, qui exécute ce fichier tel
 * quel ; d'où l'absence de tout import d'un autre outil.
 */
import { pathToFileURL } from 'node:url'

/** L'adresse du site en ligne : la même que dans tools/pages.ts (un test le vérifie). */
export const SITE = 'https://visionviewer.net'
/** La clé du site, publiée à sa racine : 8 à 128 lettres, chiffres ou tirets. */
export const KEY = 'c48b4c2711688f6f945fae4f08c5e2dd'
export const KEY_URL = `${SITE}/${KEY}.txt`
/** Le point d'entrée commun du protocole : ce qu'il reçoit est partagé entre les moteurs. */
const ENDPOINT = 'https://api.indexnow.org/indexnow'
/** Ce que le protocole accepte en une requête */
const MAX = 10_000

/** Les adresses d'un plan du site. */
export const urlsDe = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url.trim())

/** La requête qui annonce ces adresses. Refuse ce que le protocole refuserait : une adresse d'un autre site, une liste vide ou trop longue. */
export function demande(urls: string[]): { host: string; key: string; keyLocation: string; urlList: string[] } {
  const urlList = [...new Set(urls)]
  const foreign = urlList.filter((url) => url !== SITE && !url.startsWith(`${SITE}/`))
  if (foreign.length) throw new Error(`Ces adresses ne sont pas celles du site (${SITE}) : ${foreign.join(', ')}`)
  if (urlList.length === 0) throw new Error('Aucune adresse à annoncer.')
  if (urlList.length > MAX) throw new Error(`${urlList.length} adresses : le protocole en accepte ${MAX} par requête.`)
  return { host: new URL(SITE).host, key: KEY, keyLocation: KEY_URL, urlList }
}

/** Ce que veut dire chaque réponse du protocole */
const REPONSES: Record<number, string> = {
  200: 'reçues',
  202: 'reçues ; la clé reste à vérifier par le moteur (premier envoi, ou clé changée)',
  400: 'refusées : la requête est mal formée',
  403: `refusées : la clé n'est pas reconnue. Le fichier ${KEY_URL} est-il en ligne ?`,
  422: 'refusées : des adresses ne sont pas celles du site, ou la clé ne respecte pas le format',
  429: 'refusées : trop d’envois, le moteur les prend pour du courrier indésirable. Attendre avant de recommencer',
}

async function main(args: string[]): Promise<void> {
  const dry = args.includes('--essai')
  const given = args.filter((arg) => !arg.startsWith('--'))

  // Sans adresse donnée : toutes celles du plan du site en ligne
  let urls = given
  if (urls.length === 0) {
    const response = await fetch(`${SITE}/sitemap.xml`)
    if (!response.ok) throw new Error(`Le plan du site en ligne ne répond pas (${response.status}).`)
    urls = urlsDe(await response.text())
  }
  const body = demande(urls)

  // La clé doit être en ligne avant tout envoi : sans elle, le moteur refuse la demande
  const published = await fetch(KEY_URL)
  const key = published.ok ? (await published.text()).trim() : ''
  if (key !== KEY) {
    const message = `La clé n'est pas en ligne à ${KEY_URL} (réponse ${published.status}) : publier le site d'abord.`
    if (!dry) throw new Error(message)
    console.log(`Attention : ${message}`)
  }

  console.log(`${body.urlList.length} adresse(s) ${dry ? 'partiraient vers' : 'annoncées à'} ${ENDPOINT} :`)
  for (const url of body.urlList) console.log(`  ${url}`)
  if (dry) return console.log('Essai : rien n’a été envoyé.')

  const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })
  const meaning = REPONSES[response.status] ?? 'réponse inattendue'
  console.log(`Réponse ${response.status} : ${meaning}.`)
  if (response.status !== 200 && response.status !== 202) process.exitCode = 1
}

// Lancé comme une commande, et non importé par un test
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
