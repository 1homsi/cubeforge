import { useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DialogueVariables = Record<string, string | number | boolean>

export interface DialogueTreeChoice {
  /** Visible label shown to the player. Supports `{variable}` substitution. */
  label: string
  /** Node id to jump to when this choice is selected. Omit to end the dialogue. */
  next?: string
  /** When provided, the choice is hidden if this returns false. */
  condition?: (vars: DialogueVariables) => boolean
  /** Called when the player picks this choice. Useful for setting flags. */
  onSelect?: (vars: DialogueVariables) => void
}

export interface DialogueTreeNode {
  /** Speaker name. Supports `{variable}` substitution. */
  speaker?: string
  /** URL or asset path for the speaker's portrait. */
  portrait?: string
  /**
   * Dialogue text. Supports `{variable}` substitution, e.g. `"Hello, {playerName}!"`.
   */
  text: string
  /**
   * If set, the next node to advance to automatically (no choice).
   * When both `next` and `choices` are set, `choices` takes priority.
   */
  next?: string
  /** Branching choices shown to the player. */
  choices?: DialogueTreeChoice[]
  /** Called when this node becomes active. */
  onEnter?: (vars: DialogueVariables) => void
  /** Called when this node is left (via advance or choice). */
  onExit?: (vars: DialogueVariables) => void
}

export interface DialogueTreeScript {
  [id: string]: DialogueTreeNode
}

export interface DialogueTreeControls {
  /** Whether the dialogue is currently active. */
  readonly active: boolean
  /** The current node, with variable substitution applied to text and speaker. */
  readonly current: DialogueTreeNode | null
  /** The raw current node id. */
  readonly currentId: string | null
  /** The resolved choices visible to the player (filtered by conditions). */
  readonly visibleChoices: DialogueTreeChoice[]
  /** Current dialogue variables. */
  readonly variables: DialogueVariables
  /**
   * Start the dialogue from `startId` (defaults to the first key in the script).
   * @param initialVars Initial variable values — merged into any existing vars.
   */
  start(script: DialogueTreeScript, startId?: string, initialVars?: DialogueVariables): void
  /**
   * Advance to the next node.
   * If the current node has choices, pass `choiceIndex` to select one.
   * If `choiceIndex` is omitted and the node has a `next` pointer, advances there.
   * If neither, ends the dialogue.
   */
  advance(choiceIndex?: number): void
  /** Jump directly to a node by id. */
  jumpTo(id: string): void
  /** Set one or more dialogue variables. */
  setVar(key: string, value: string | number | boolean): void
  /** Close / end the dialogue. */
  close(): void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function interpolate(text: string, vars: DialogueVariables): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : `{${key}}`
  })
}

function applyVars(node: DialogueTreeNode, vars: DialogueVariables): DialogueTreeNode {
  return {
    ...node,
    text: interpolate(node.text, vars),
    speaker: node.speaker ? interpolate(node.speaker, vars) : node.speaker,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Full-featured branching dialogue tree with variable substitution, conditional
 * choices, enter/exit callbacks, and imperative jump support.
 *
 * Compatible with `<DialogueBox>` — pass `controls.current` and
 * `controls.visibleChoices` as props.
 *
 * @example
 * ```tsx
 * const dialogue = useDialogueTree()
 *
 * dialogue.start(npcScript, 'greeting', { playerName: 'Aria' })
 *
 * // In your UI:
 * if (dialogue.active && dialogue.current) {
 *   return (
 *     <DialogueBox
 *       speaker={dialogue.current.speaker}
 *       text={dialogue.current.text}
 *       choices={dialogue.visibleChoices.map(c => c.label)}
 *       onAdvance={dialogue.advance}
 *     />
 *   )
 * }
 * ```
 *
 * ### Script example
 * ```ts
 * const innkeeperScript: DialogueTreeScript = {
 *   greeting: {
 *     speaker: 'Innkeeper',
 *     text: 'Welcome, {playerName}! Care for a room?',
 *     choices: [
 *       { label: 'Yes, one room please.', next: 'book_room' },
 *       {
 *         label: 'I heard about the bounty...',
 *         next: 'bounty',
 *         condition: (vars) => vars.hasBountyQuest === true,
 *       },
 *       { label: 'Just passing through.', next: 'farewell' },
 *     ],
 *   },
 *   book_room: {
 *     speaker: 'Innkeeper',
 *     text: "That'll be 10 gold. Enjoy your stay!",
 *     onEnter: (vars) => { vars.goldSpent = (vars.goldSpent as number ?? 0) + 10 },
 *   },
 *   // ...
 * }
 * ```
 */
export function useDialogueTree(): DialogueTreeControls {
  const [active, setActive] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [variables, setVariables] = useState<DialogueVariables>({})

  const scriptRef = useRef<DialogueTreeScript | null>(null)
  const varsRef = useRef<DialogueVariables>({})

  function setCurrentNode(id: string | null): void {
    if (!id || !scriptRef.current) {
      setActive(false)
      setCurrentId(null)
      return
    }
    const node = scriptRef.current[id]
    if (!node) {
      setActive(false)
      setCurrentId(null)
      return
    }
    node.onEnter?.(varsRef.current)
    setCurrentId(id)
  }

  const start = useCallback(
    (script: DialogueTreeScript, startId?: string, initialVars?: DialogueVariables) => {
      scriptRef.current = script
      const newVars = { ...varsRef.current, ...initialVars }
      varsRef.current = newVars
      setVariables(newVars)
      const id = startId ?? Object.keys(script)[0]
      setActive(true)
      setCurrentNode(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const advance = useCallback(
    (choiceIndex?: number) => {
      if (!scriptRef.current || !currentId) return
      const node = scriptRef.current[currentId]
      if (!node) {
        setActive(false)
        setCurrentId(null)
        return
      }

      node.onExit?.(varsRef.current)

      if (node.choices && node.choices.length > 0 && choiceIndex !== undefined) {
        const visible = node.choices.filter((c) => !c.condition || c.condition(varsRef.current))
        const choice = visible[choiceIndex]
        if (choice) {
          choice.onSelect?.(varsRef.current)
          if (choice.next && scriptRef.current[choice.next]) {
            setCurrentNode(choice.next)
          } else {
            setActive(false)
            setCurrentId(null)
          }
        }
        return
      }

      // No choices — follow next pointer or advance sequentially
      if (node.next && scriptRef.current[node.next]) {
        setCurrentNode(node.next)
      } else {
        // Auto-advance to next sequential key
        const keys = Object.keys(scriptRef.current)
        const idx = keys.indexOf(currentId)
        if (idx >= 0 && idx + 1 < keys.length) {
          setCurrentNode(keys[idx + 1])
        } else {
          setActive(false)
          setCurrentId(null)
        }
      }
    },
    [currentId],
  )

  const jumpTo = useCallback((id: string) => {
    if (!scriptRef.current?.[id]) return
    const current = scriptRef.current[currentId ?? '']
    current?.onExit?.(varsRef.current)
    setCurrentNode(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const setVar = useCallback((key: string, value: string | number | boolean) => {
    varsRef.current = { ...varsRef.current, [key]: value }
    setVariables({ ...varsRef.current })
  }, [])

  const close = useCallback(() => {
    if (scriptRef.current && currentId) {
      scriptRef.current[currentId]?.onExit?.(varsRef.current)
    }
    setActive(false)
    setCurrentId(null)
    scriptRef.current = null
  }, [currentId])

  const rawNode = scriptRef.current && currentId ? (scriptRef.current[currentId] ?? null) : null
  const current = rawNode ? applyVars(rawNode, varsRef.current) : null
  const visibleChoices = rawNode?.choices
    ? rawNode.choices.filter((c) => !c.condition || c.condition(varsRef.current))
    : []

  return {
    active,
    current,
    currentId,
    visibleChoices,
    variables,
    start,
    advance,
    jumpTo,
    setVar,
    close,
  }
}
