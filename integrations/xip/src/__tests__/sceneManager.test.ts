// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSceneManager } from '../hooks/useSceneManager'

describe('useSceneManager', () => {
  it('initialises with the given scene', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    expect(result.current.current).toBe('menu')
    expect(result.current.stack).toEqual(['menu'])
  })

  it('push adds a scene to the top of the stack', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    act(() => result.current.push('gameplay'))
    expect(result.current.current).toBe('gameplay')
    expect(result.current.stack).toEqual(['menu', 'gameplay'])
  })

  it('pop removes the top scene and returns it', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    act(() => result.current.push('gameplay'))
    act(() => result.current.push('pause'))
    expect(result.current.stack).toEqual(['menu', 'gameplay', 'pause'])

    let popped: string | undefined
    act(() => {
      popped = result.current.pop()
    })
    expect(popped).toBe('pause')
    expect(result.current.current).toBe('gameplay')
    expect(result.current.stack).toEqual(['menu', 'gameplay'])
  })

  it('pop with single scene does not pop', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    let popped: string | undefined
    act(() => {
      popped = result.current.pop()
    })
    // Stack unchanged
    expect(popped).toBeUndefined()
    expect(result.current.current).toBe('menu')
    expect(result.current.stack).toEqual(['menu'])
  })

  it('replace replaces the top scene', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    act(() => result.current.push('gameplay'))
    act(() => result.current.replace('gameOver'))
    expect(result.current.current).toBe('gameOver')
    expect(result.current.stack).toEqual(['menu', 'gameOver'])
  })

  it('reset clears the entire stack and sets a single scene', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    act(() => result.current.push('gameplay'))
    act(() => result.current.push('pause'))
    act(() => result.current.reset('mainMenu'))
    expect(result.current.current).toBe('mainMenu')
    expect(result.current.stack).toEqual(['mainMenu'])
  })

  it('has returns true when scene is in the stack', () => {
    const { result } = renderHook(() => useSceneManager('menu'))
    act(() => result.current.push('gameplay'))
    expect(result.current.has('menu')).toBe(true)
    expect(result.current.has('gameplay')).toBe(true)
    expect(result.current.has('pause')).toBe(false)
  })
})

describe('useSceneManager pause semantics', () => {
  it('pauses scenes below a pausesBelow overlay', () => {
    const { result } = renderHook(() =>
      useSceneManager('gameplay', {
        gameplay: { name: 'gameplay' },
        pause: { name: 'pause', pausesBelow: true },
      }),
    )
    expect(result.current.isPaused('gameplay')).toBe(false)

    act(() => result.current.push('pause'))
    expect(result.current.isPaused('gameplay')).toBe(true)
    expect(result.current.isPaused('pause')).toBe(false) // top is never paused
    expect(result.current.current).toBe('pause')
  })

  it('unregistered scenes are never paused', () => {
    const { result } = renderHook(() => useSceneManager('a', { pause: { name: 'pause', pausesBelow: true } }))
    act(() => result.current.push('unknown'))
    expect(result.current.isPaused('a')).toBe(false)
  })

  it('defaults to checking the active scene', () => {
    const { result } = renderHook(() => useSceneManager('game', { modal: { name: 'modal', pausesBelow: true } }))
    act(() => result.current.push('modal'))
    // active scene itself: not paused
    expect(result.current.isPaused()).toBe(false)
  })
})
