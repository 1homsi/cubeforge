export type InterpolationMode = 'LINEAR' | 'STEP' | 'CUBICSPLINE'

export interface KeyframeTrack {
  nodeName: string
  nodeIndex: number
  property: 'position' | 'quaternion' | 'scale' | 'morphTargetInfluences'
  times: Float32Array
  values: Float32Array
  interpolation: InterpolationMode
}

export interface AnimationClip {
  name: string
  tracks: KeyframeTrack[]
  duration: number
}

export class AnimationMixer {
  private _clips: Map<string, AnimationClip> = new Map()
  private _actions: Map<string, { clip: AnimationClip; time: number; weight: number; playing: boolean }> = new Map()
  private _root: object

  constructor(root: object) {
    this._root = root
  }

  clipAction(clip: AnimationClip): { play(): void; stop(): void; setWeight(w: number): void } {
    this._clips.set(clip.name, clip)
    const action = { clip, time: 0, weight: 1, playing: false }
    this._actions.set(clip.name, action)
    return {
      play: () => {
        action.playing = true
      },
      stop: () => {
        action.playing = false
      },
      setWeight: (w: number) => {
        action.weight = w
      },
    }
  }

  update(dt: number): void {
    for (const action of this._actions.values()) {
      if (action.playing) action.time = (action.time + dt) % action.clip.duration
    }
    void this._root
  }

  stopAllAction(): void {
    for (const action of this._actions.values()) action.playing = false
  }
}
