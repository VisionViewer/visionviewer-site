import { useEffect, useState } from 'react'

/** Même seuil que la mise en page « ordinateur » de styles/global.css. */
const WIDE_QUERY = '(min-width: 1000px) and (min-height: 620px)'

/** Vrai sur ordinateur, où la démo est présentée dans un téléphone, à côté de son panneau. */
export function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY)
    const onChange = () => setWide(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return wide
}
