import { readFileSync } from 'node:fs'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { isAccueil, pageInputs, sitePages } from './tools/pages'
import { siteRoutes } from './tools/routes'

/**
 * La scène 3D de la page de présentation est chargée à part (la page reste lisible sans elle),
 * donc le navigateur ne la découvre qu'en exécutant le script principal. Ce plugin l'annonce
 * dès le HTML : la scène et three.js sont téléchargés en même temps que le reste. Il vaut pour la
 * présentation de chaque langue (`fr.html`, `en.html`…).
 */
function preloadLandingScene(): Plugin {
  let root = process.cwd()
  return {
    name: 'preload-landing-scene',
    configResolved(config) {
      root = config.root
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !isAccueil(ctx.filename.slice(root.length + 1).split('\\').join('/'))) return
        const chunks = Object.values(ctx.bundle).flatMap((file) => (file.type === 'chunk' ? [file] : []))
        const scene = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/landing/scene.js'))
        if (!scene) return

        // La scène et tout ce qu'elle importe (three.js, données des salles…)
        const files = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          chunks.find((chunk) => chunk.fileName === fileName)?.imports.forEach(visit)
        }
        visit(scene.fileName)

        // Sauf ce que la page annonce déjà d'elle-même
        const announced = [...files].filter((file) => !html.includes(file))
        return announced.map(
          (file): HtmlTagDescriptor => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
            injectTo: 'head',
          }),
        )
      },
    },
  }
}

/**
 * Les en-têtes de sécurité que Vercel pose sur toutes les pages (vercel.json) : politique de
 * contenu, interdiction d'être encadré… `npm run preview` les pose aussi, pour éprouver la
 * politique sur la version construite avant une mise en ligne : un script ou une image qu'elle
 * refuserait ne se verrait, sinon, qu'une fois en ligne.
 */
function securityHeaders(): Record<string, string> {
  const { headers } = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const everywhere = headers.find((rule) => rule.source === '/(.*)')
  return Object.fromEntries((everywhere?.headers ?? []).map(({ key, value }) => [key, value]))
}

export default defineConfig({
  plugins: [siteRoutes(), sitePages(), react(), preloadLandingScene()],
  preview: { headers: securityHeaders() },
  build: {
    // Une entrée par page et par langue : la présentation (fr.html, en.html), puis le dossier de la
    // langue (fr/demo.html, fr/blog.html, fr/blog/*.html, les pages légales…). Voir tools/pages.ts.
    rolldownOptions: {
      input: pageInputs(),
    },
    // three.js (~1 Mo) est un chunk à part, partagé par la scène de la présentation et la vue 3D
    chunkSizeWarningLimit: 1100,
  },
})
