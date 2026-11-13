import { useEffect, useMemo, useRef } from 'react'

interface SpringOptions {
  stiffness: number
  damping: number
  mass: number
}

/**
 * Valeur animée par un ressort amorti, sans bibliothèque. Le zoom du plan est la seule
 * animation utile dès le premier affichage : la calculer ici évite de charger le moteur
 * d'animation avec la page (il arrive juste après, voir `motionFeatures.ts`).
 */
export function useSpringValue(
  initial: number,
  { stiffness, damping, mass }: SpringOptions,
  onChange: (value: number) => void,
) {
  const state = useRef({ value: initial, velocity: 0, target: initial, frame: 0, time: 0 })
  const listener = useRef(onChange)
  useEffect(() => {
    listener.current = onChange
  }, [onChange])

  useEffect(() => {
    const s = state.current
    return () => cancelAnimationFrame(s.frame)
  }, [])

  return useMemo(() => {
    const s = state.current
    const tick = (now: number) => {
      // Pas fixes de 4 ms : le mouvement est le même quel que soit le rythme d'affichage
      let remaining = Math.min(now - s.time, 64) / 1000
      s.time = now
      while (remaining > 0) {
        const step = Math.min(remaining, 0.004)
        const force = -stiffness * (s.value - s.target) - damping * s.velocity
        s.velocity += (force / mass) * step
        s.value += s.velocity * step
        remaining -= step
      }
      const settled = Math.abs(s.value - s.target) < 0.0005 && Math.abs(s.velocity) < 0.005
      if (settled) {
        s.value = s.target
        s.velocity = 0
      }
      listener.current(s.value)
      s.frame = settled ? 0 : requestAnimationFrame(tick)
    }

    return {
      get: () => s.value,
      /** Fait glisser la valeur vers `target` (directement, si l'utilisateur limite les animations). */
      set(target: number) {
        s.target = target
        if (s.frame || (target === s.value && s.velocity === 0)) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          s.value = target
          listener.current(target)
          return
        }
        s.time = performance.now()
        s.frame = requestAnimationFrame(tick)
      },
    }
  }, [stiffness, damping, mass])
}
