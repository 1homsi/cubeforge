import React from 'react'
import type { DialogueControls, DialogueLine } from '../hooks/useDialogue'

export interface DialogueBoxStyle {
  /** Background color of the dialogue box. Default '#1a1a2e'. */
  background?: string
  /** Text color. Default '#e8eaf6'. */
  color?: string
  /** Border color. Default '#4fc3f7'. */
  borderColor?: string
  /** Portrait image size in px. Default 80. */
  portraitSize?: number
  /** Font family. Default 'monospace'. */
  fontFamily?: string
  /** Font size for dialogue text. Default 14. */
  fontSize?: number
}

export interface DialogueBoxProps {
  /** The controls returned by `useDialogue()`. */
  dialogue: DialogueControls
  /**
   * Called when the player presses the box or the advance button.
   * Receives the current line so you can play SFX, etc.
   */
  onAdvance?: (line: DialogueLine) => void
  /**
   * Called when the dialogue closes (no more lines / close() called).
   */
  onClose?: () => void
  style?: DialogueBoxStyle
}

/**
 * A ready-made UI overlay that renders the current dialogue line with
 * optional speaker name, portrait image, and choice buttons.
 *
 * Renders as a fixed-position overlay at the bottom of the viewport.
 * Invisible while `dialogue.active` is false.
 *
 * @example
 * function Game() {
 *   const dialogue = useDialogue()
 *   return (
 *     <>
 *       <YourGame onNpcInteract={() => dialogue.start(npcScript)} />
 *       <DialogueBox dialogue={dialogue} />
 *     </>
 *   )
 * }
 */
export function DialogueBox({ dialogue, onAdvance, onClose, style = {} }: DialogueBoxProps): React.ReactElement | null {
  const {
    background = '#1a1a2e',
    color = '#e8eaf6',
    borderColor = '#4fc3f7',
    portraitSize = 80,
    fontFamily = 'monospace',
    fontSize = 14,
  } = style

  if (!dialogue.active || !dialogue.current) return null

  const line = dialogue.current

  function handleAdvance(choiceIndex?: number) {
    if (!line) return
    onAdvance?.(line)
    dialogue.advance(choiceIndex)
    if (!dialogue.active) {
      onClose?.()
    }
  }

  const box: React.CSSProperties = {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(680px, 92vw)',
    background,
    border: `2px solid ${borderColor}`,
    borderRadius: 8,
    padding: 16,
    fontFamily,
    fontSize,
    color,
    boxSizing: 'border-box',
    zIndex: 9000,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    userSelect: 'none',
  }

  const header: React.CSSProperties = {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  }

  const portraitStyle: React.CSSProperties = {
    width: portraitSize,
    height: portraitSize,
    borderRadius: 6,
    border: `1px solid ${borderColor}`,
    objectFit: 'cover',
    flexShrink: 0,
  }

  const textBlock: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  }

  const speakerStyle: React.CSSProperties = {
    fontWeight: 700,
    color: borderColor,
    fontSize: fontSize + 1,
    marginBottom: 4,
  }

  const choicesStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 6,
  }

  const choiceBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${borderColor}`,
    borderRadius: 4,
    color,
    fontFamily,
    fontSize,
    padding: '5px 12px',
    cursor: 'pointer',
    textAlign: 'left',
  }

  const advanceBtnStyle: React.CSSProperties = {
    alignSelf: 'flex-end',
    background: 'transparent',
    border: `1px solid ${borderColor}`,
    borderRadius: 4,
    color: borderColor,
    fontFamily,
    fontSize: fontSize - 1,
    padding: '3px 10px',
    cursor: 'pointer',
    marginTop: 4,
  }

  const hasChoices = line.choices && line.choices.length > 0

  return (
    <div style={box} onClick={hasChoices ? undefined : () => handleAdvance()}>
      <div style={header}>
        {line.portrait && <img src={line.portrait} alt={line.speaker ?? 'speaker'} style={portraitStyle} />}
        <div style={textBlock}>
          {line.speaker && <div style={speakerStyle}>{line.speaker}</div>}
          <div>{line.text}</div>
        </div>
      </div>

      {hasChoices ? (
        <div style={choicesStyle}>
          {line.choices!.map((choice, i) => (
            <button key={i} style={choiceBtnStyle} onClick={() => handleAdvance(i)}>
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <button style={advanceBtnStyle} onClick={() => handleAdvance()}>
          ▶ Continue
        </button>
      )}
    </div>
  )
}
