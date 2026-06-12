import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NetMessage, Room } from '../room'
import { useNetworkInput } from '../useNetworkInput'

function createMockRoom() {
  let messageHandler: ((msg: NetMessage) => void) | null = null
  const room = {
    get isConnected() {
      return false
    },
    broadcast: vi.fn(),
    onMessage: vi.fn((handler: (msg: NetMessage) => void) => {
      messageHandler = handler
      return vi.fn()
    }),
  } as unknown as Room

  return {
    room,
    emit(message: NetMessage) {
      if (!messageHandler) throw new Error('No room message handler registered')
      messageHandler(message)
    },
  }
}

describe('useNetworkInput', () => {
  it('publishes remote input updates through React state', () => {
    const { room, emit } = createMockRoom()
    const { result, unmount } = renderHook(() => useNetworkInput({ room, keys: ['Space'] }))
    const initialMap = result.current.remoteInputs

    act(() => {
      emit({
        type: 'input:state',
        peerId: 'peer-a',
        payload: { Space: true },
      })
    })

    expect(result.current.remoteInputs).not.toBe(initialMap)
    expect(result.current.remoteInputs.get('peer-a')).toEqual({ Space: true })

    unmount()
  })
})
