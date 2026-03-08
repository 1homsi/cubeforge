import { useState, useCallback, useRef } from 'react'

export interface DialogueLine {
  speaker?: string
  text: string
  choices?: { label: string; next?: string }[]
}

export interface DialogueScript {
  [id: string]: DialogueLine
}

export interface DialogueControls {
  readonly active: boolean
  readonly current: DialogueLine | null
  readonly currentId: string | null
  start(script: DialogueScript, startId?: string): void
  advance(choiceIndex?: number): void
  close(): void
}

export function useDialogue(): DialogueControls {
  const [active, setActive] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const scriptRef = useRef<DialogueScript | null>(null)

  const start = useCallback((script: DialogueScript, startId?: string) => {
    scriptRef.current = script
    const id = startId ?? Object.keys(script)[0]
    setCurrentId(id)
    setActive(true)
  }, [])

  const advance = useCallback((choiceIndex?: number) => {
    if (!scriptRef.current || !currentId) return
    const line = scriptRef.current[currentId]
    if (!line) { setActive(false); setCurrentId(null); return }

    if (line.choices && choiceIndex !== undefined) {
      const choice = line.choices[choiceIndex]
      if (choice?.next && scriptRef.current[choice.next]) {
        setCurrentId(choice.next)
      } else {
        setActive(false); setCurrentId(null)
      }
    } else {
      // Auto-advance to next sequential key
      const keys = Object.keys(scriptRef.current)
      const idx = keys.indexOf(currentId)
      if (idx >= 0 && idx + 1 < keys.length) {
        setCurrentId(keys[idx + 1])
      } else {
        setActive(false); setCurrentId(null)
      }
    }
  }, [currentId])

  const close = useCallback(() => {
    setActive(false)
    setCurrentId(null)
    scriptRef.current = null
  }, [])

  const current = (scriptRef.current && currentId) ? scriptRef.current[currentId] ?? null : null

  return { active, current, currentId, start, advance, close }
}
