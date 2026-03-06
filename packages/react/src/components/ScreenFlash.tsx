import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface ScreenFlashHandle {
  flash(color: string, duration: number): void
}

export const ScreenFlash = forwardRef<ScreenFlashHandle>((_, ref) => {
  const divRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    flash(color: string, duration: number) {
      const el = divRef.current
      if (!el) return

      el.style.backgroundColor = color
      el.style.opacity = '1'
      el.style.transition = 'none'

      const durationMs = duration * 1000

      // Next frame: start the fade
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!divRef.current) return
          divRef.current.style.transition = `opacity ${durationMs}ms linear`
          divRef.current.style.opacity = '0'
        })
      })
    },
  }))

  return (
    <div
      ref={divRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0,
        backgroundColor: 'transparent',
      }}
    />
  )
})

ScreenFlash.displayName = 'ScreenFlash'
