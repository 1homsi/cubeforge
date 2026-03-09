# useDialogue

Drives an NPC dialogue system. Feed it a script of dialogue lines and it returns the current line, advance controls, and choice handling.

## Signature

```ts
function useDialogue(script: DialogueScript): DialogueControls
```

## Types

```ts
interface DialogueLine {
  speaker: string
  text: string
  choices?: string[]
}

type DialogueScript = DialogueLine[]

interface DialogueControls {
  /** The current DialogueLine, or null when the dialogue is not active */
  current: DialogueLine | null
  /** Advance to the next line (or select a choice by index) */
  advance: (choiceIndex?: number) => void
  /** Whether the dialogue is currently active */
  isActive: boolean
  /** Begin the dialogue from the first line */
  start: () => void
  /** Available choices for the current line (empty array if none) */
  choices: string[]
}
```

## Example

```tsx
import { useDialogue } from 'cubeforge'

const innkeeperScript = [
  { speaker: 'Innkeeper', text: 'Welcome traveller! Need a room?' },
  {
    speaker: 'Innkeeper',
    text: 'What will it be?',
    choices: ['Rest (10 gold)', 'No thanks'],
  },
  { speaker: 'Innkeeper', text: 'Safe travels!' },
]

function Innkeeper({ x, y }: { x: number; y: number }) {
  const dialogue = useDialogue(innkeeperScript)

  useTriggerEnter(() => {
    if (!dialogue.isActive) dialogue.start()
  }, { tag: 'player' })

  return (
    <Entity tags={['npc']}>
      <Transform x={x} y={y} />
      <Sprite width={28} height={42} color="#a67c52" />
      <BoxCollider width={40} height={42} isTrigger />
      {dialogue.isActive && dialogue.current && (
        <DialogueBox
          speaker={dialogue.current.speaker}
          text={dialogue.current.text}
          choices={dialogue.choices}
          onAdvance={dialogue.advance}
        />
      )}
    </Entity>
  )
}
```

## Notes

- `advance()` with no argument moves to the next line. Pass a `choiceIndex` to select a branching choice.
- When the last line is advanced past, `isActive` becomes `false` and `current` returns to `null`.
- The hook does not render any UI on its own — pair it with your own dialogue box component.
- Must be called inside `<Game>`.
