import qrcode from 'qrcode-generator'

/** Marge blanche autour du code, en modules : elle le garde lisible sur un fond sombre. */
const QUIET = 2

export interface QrShape {
  /** Côté du dessin, marge comprise, en modules */
  size: number
  /** Marge blanche, en modules */
  quiet: number
  /** Tracé SVG des modules sombres, dans un repère où le code commence en (0, 0) */
  path: string
}

/** Calcule le dessin d'un QR code (correction d'erreur moyenne). */
export function qrShape(text: string): QrShape {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  let path = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`
    }
  }
  return { size: count + 2 * QUIET, quiet: QUIET, path }
}

const escapeAttribute = (value: string) =>
  value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** Le même QR code en balise SVG, pour la page de présentation (sans React). */
export function qrSvg(text: string, label: string): string {
  const { size, quiet, path } = qrShape(text)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${size} ${size}" ` +
    `role="img" aria-label="${escapeAttribute(label)}" shape-rendering="crispEdges">` +
    `<rect x="${-quiet}" y="${-quiet}" width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${path}" fill="#040405"/></svg>`
  )
}
