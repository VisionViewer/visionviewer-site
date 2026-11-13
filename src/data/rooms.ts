import { buildLayout, type RoomConfig } from '../lib/room'

/**
 * Toutes les salles de `src/data/rooms/*.json` sont chargées automatiquement,
 * dans l'ordre alphabétique des noms de fichiers.
 */
const modules = import.meta.glob<RoomConfig>('./rooms/*.json', {
  eager: true,
  import: 'default',
})

export const rooms: RoomConfig[] = Object.keys(modules)
  .sort()
  .map((path) => modules[path])

export const layouts = rooms.map(buildLayout)
