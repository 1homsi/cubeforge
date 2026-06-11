import { createContext } from 'react'
import type { AudioOcclusion } from '@cubeforge/renderer3d'

/**
 * Provides the AudioOcclusion singleton created by useAudioOcclusion() to all
 * descendant AudioSource3DComponent instances.
 */
export const AudioOcclusionContext = createContext<AudioOcclusion | null>(null)
