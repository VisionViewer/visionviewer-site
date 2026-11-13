import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * La scène 3D de la page de présentation est chargée à part (la page reste lisible sans elle),
 * donc le navigateur ne la découvre qu'en exécutant le script principal. Ce plugin l'annonce
 * dès le HTML : la scène et three.js sont téléchargés en même temps que le reste.
 */
function preloadLandingScene(): Plugin {
  return {
    name: 'preload-landing-scene',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.filename.endsWith('index.html')) return
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

export default defineConfig({
  plugins: [react(), preloadLandingScene()],
  build: {
    // Deux pages : la présentation (index.html) et la démo (demo.html, servie sur /demo)
    rolldownOptions: {
      input: { index: 'index.html', demo: 'demo.html' },
    },
    // three.js (~1 Mo) est un chunk à part, partagé par la scène de la présentation et la vue 3D
    chunkSizeWarningLimit: 1100,
  },
})
