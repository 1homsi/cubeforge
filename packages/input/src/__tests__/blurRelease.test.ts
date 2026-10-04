import { describe, expect, it } from 'vitest'
import { Keyboard } from '../keyboard'
import { Mouse } from '../mouse'

describe('focus loss releases held input', () => {
  it('keyboard', () => {
    const kb = new Keyboard()
    kb.attach(window)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))
    expect(kb.isDown('KeyA')).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(kb.isDown('KeyA')).toBe(false)
    expect(kb.isReleased('KeyA')).toBe(true)
    kb.detach()
  })

  it('mouse, including a release outside the target', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const mouse = new Mouse()
    mouse.attach(el)
    el.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    expect(mouse.isDown(0)).toBe(false)
    expect(mouse.isReleased(0)).toBe(true)
    el.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
    window.dispatchEvent(new Event('blur'))
    expect(mouse.isDown(2)).toBe(false)
    mouse.detach()
    el.remove()
  })
})
