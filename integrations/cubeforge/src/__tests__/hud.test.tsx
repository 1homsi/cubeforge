// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { HUD, HUDZone, HUDBar, HUDCounter, HUDButton, HUDMenu } from '../components/HUD'

beforeEach(() => {
  cleanup()
})

/** HUD doesn't accept an arbitrary `data-testid` prop — query its known marker attribute instead. */
function getHudRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-cubeforge-hud]')
  if (!root) throw new Error('HUD root not found')
  return root as HTMLElement
}

describe('HUD', () => {
  it('renders children', () => {
    const { getByText } = render(
      <HUD>
        <span>hello</span>
      </HUD>,
    )
    expect(getByText('hello')).toBeTruthy()
  })

  it('is fully opaque by default', () => {
    const { container } = render(<HUD />)
    expect(getHudRoot(container).style.opacity).toBe('1')
  })

  it('is invisible when visible=false, regardless of transitioning', () => {
    const { container } = render(<HUD visible={false} transitioning />)
    expect(getHudRoot(container).style.opacity).toBe('0')
  })

  it('dims to dimmedOpacity when transitioning and dimDuringTransitions is on (default)', () => {
    const { container } = render(<HUD transitioning dimmedOpacity={0.4} />)
    expect(getHudRoot(container).style.opacity).toBe('0.4')
  })

  it('does not dim when dimDuringTransitions is false, even while transitioning', () => {
    const { container } = render(<HUD transitioning dimDuringTransitions={false} />)
    expect(getHudRoot(container).style.opacity).toBe('1')
  })

  it('is not dimmed while transitioning=false', () => {
    const { container } = render(<HUD transitioning={false} dimmedOpacity={0.4} />)
    expect(getHudRoot(container).style.opacity).toBe('1')
  })
})

describe('HUDZone', () => {
  it('renders children inside a positioned container', () => {
    const { getByText } = render(
      <HUD>
        <HUDZone position="topRight">
          <span>score</span>
        </HUDZone>
      </HUD>,
    )
    expect(getByText('score')).toBeTruthy()
  })
})

describe('HUDBar', () => {
  it('renders a progressbar with correct aria attributes', () => {
    const { getByRole } = render(<HUDBar value={30} max={100} label="HP" />)
    const bar = getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('30')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('clamps the fill percentage between 0 and 1', () => {
    const { getByRole } = render(<HUDBar value={999} max={100} />)
    const fill = getByRole('progressbar').firstElementChild as HTMLElement
    expect(fill.style.width).toBe('100%')
  })
})

describe('HUDCounter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the value, icon, and label', () => {
    const { getByText } = render(<HUDCounter value={5} icon="🪙" label="coins" />)
    expect(getByText('5')).toBeTruthy()
    expect(getByText('🪙')).toBeTruthy()
    expect(getByText('coins')).toBeTruthy()
  })

  it('pulses (scales up then back) when the value changes and pulse is on', () => {
    const { getByText, rerender } = render(<HUDCounter value={5} pulse />)
    const wrapper = getByText('5').parentElement as HTMLElement
    expect(wrapper.style.transform).toBe('scale(1)')

    rerender(<HUDCounter value={6} pulse />)
    expect(wrapper.style.transform).toBe('scale(1.25)')

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(wrapper.style.transform).toBe('scale(1)')
  })

  it('does not pulse when pulse is false', () => {
    const { getByText, rerender } = render(<HUDCounter value={5} pulse={false} />)
    const wrapper = getByText('5').parentElement as HTMLElement
    rerender(<HUDCounter value={6} pulse={false} />)
    expect(wrapper.style.transform).toBe('scale(1)')
  })
})

describe('HUDButton', () => {
  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const { getByText } = render(<HUDButton onClick={onClick}>Jump</HUDButton>)
    fireEvent.click(getByText('Jump'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    const { getByText } = render(
      <HUDButton onClick={onClick} disabled>
        Jump
      </HUDButton>,
    )
    fireEvent.click(getByText('Jump'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a native, keyboard-activatable button', () => {
    const { getByText } = render(<HUDButton onClick={() => {}}>Jump</HUDButton>)
    const button = getByText('Jump') as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(false)
  })

  it('shows a focus outline while focused', () => {
    const { getByText } = render(<HUDButton onClick={() => {}}>Jump</HUDButton>)
    const button = getByText('Jump') as HTMLButtonElement
    expect(button.style.borderColor).toBe('transparent')
    fireEvent.focus(button)
    expect(button.style.border).toContain('#4fc3f7')
    fireEvent.blur(button)
    expect(button.style.borderColor).toBe('transparent')
  })
})

describe('HUDMenu', () => {
  const items = [
    { label: 'Resume', onSelect: vi.fn() },
    { label: 'Restart', onSelect: vi.fn() },
    { label: 'Quit', onSelect: vi.fn(), disabled: true },
  ]

  it('renders one button per item', () => {
    const { getByText } = render(<HUDMenu items={items} />)
    expect(getByText('Resume')).toBeTruthy()
    expect(getByText('Restart')).toBeTruthy()
    expect(getByText('Quit')).toBeTruthy()
  })

  it('calls the item onSelect when its button is clicked', () => {
    const onSelect = vi.fn()
    const { getByText } = render(<HUDMenu items={[{ label: 'Resume', onSelect }]} />)
    fireEvent.click(getByText('Resume'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('disables the button for a disabled item', () => {
    const { getByText } = render(<HUDMenu items={items} />)
    expect((getByText('Quit') as HTMLButtonElement).disabled).toBe(true)
  })

  it('moves focus to the next item on ArrowDown (column direction)', () => {
    const { getByText, getByRole } = render(<HUDMenu items={items} />)
    const resume = getByText('Resume') as HTMLButtonElement
    const restart = getByText('Restart') as HTMLButtonElement
    resume.focus()
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(restart)
  })

  it('skips disabled items when moving focus', () => {
    const { getByText, getByRole } = render(<HUDMenu items={items} />)
    const restart = getByText('Restart') as HTMLButtonElement
    restart.focus()
    // Quit is disabled, so ArrowDown from the last enabled item wraps to Resume.
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(getByText('Resume'))
  })

  it('moves focus to the previous item on ArrowUp', () => {
    const { getByText, getByRole } = render(<HUDMenu items={items} />)
    const resume = getByText('Resume') as HTMLButtonElement
    const restart = getByText('Restart') as HTMLButtonElement
    restart.focus()
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(resume)
  })

  it('uses ArrowLeft/ArrowRight when direction="row"', () => {
    const { getByText, getByRole } = render(<HUDMenu items={items} direction="row" />)
    const resume = getByText('Resume') as HTMLButtonElement
    const restart = getByText('Restart') as HTMLButtonElement
    resume.focus()
    fireEvent.keyDown(getByRole('menu'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(restart)
  })
})
