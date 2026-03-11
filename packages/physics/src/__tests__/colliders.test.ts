import { describe, it, expect } from 'vitest'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'
import { createCompoundCollider } from '../components/compoundCollider'

describe('createBoxCollider', () => {
  it('creates a BoxCollider with given dimensions', () => {
    const c = createBoxCollider(32, 48)
    expect(c.type).toBe('BoxCollider')
    expect(c.width).toBe(32)
    expect(c.height).toBe(48)
  })

  describe('default values', () => {
    const c = createBoxCollider(10, 10)

    it('default offsets are 0', () => {
      expect(c.offsetX).toBe(0)
      expect(c.offsetY).toBe(0)
    })

    it('default isTrigger is false', () => {
      expect(c.isTrigger).toBe(false)
    })

    it('default layer is default', () => {
      expect(c.layer).toBe('default')
    })

    it('default mask is *', () => {
      expect(c.mask).toBe('*')
    })

    it('default slope is 0', () => {
      expect(c.slope).toBe(0)
    })

    it('default oneWay is false', () => {
      expect(c.oneWay).toBe(false)
    })

    it('default friction is 0', () => {
      expect(c.friction).toBe(0)
    })

    it('default restitution is 0', () => {
      expect(c.restitution).toBe(0)
    })

    it('default frictionCombineRule is average', () => {
      expect(c.frictionCombineRule).toBe('average')
    })

    it('default restitutionCombineRule is average', () => {
      expect(c.restitutionCombineRule).toBe('average')
    })

    it('default enabled is true', () => {
      expect(c.enabled).toBe(true)
    })

    it('default group is empty string', () => {
      expect(c.group).toBe('')
    })
  })

  describe('custom values', () => {
    it('accepts trigger option', () => {
      const c = createBoxCollider(10, 10, { isTrigger: true })
      expect(c.isTrigger).toBe(true)
    })

    it('accepts layer and mask', () => {
      const c = createBoxCollider(10, 10, { layer: 'enemies', mask: ['player', 'projectile'] })
      expect(c.layer).toBe('enemies')
      expect(c.mask).toEqual(['player', 'projectile'])
    })

    it('accepts slope', () => {
      const c = createBoxCollider(10, 10, { slope: 30 })
      expect(c.slope).toBe(30)
    })

    it('accepts oneWay', () => {
      const c = createBoxCollider(10, 10, { oneWay: true })
      expect(c.oneWay).toBe(true)
    })

    it('accepts offsets', () => {
      const c = createBoxCollider(10, 10, { offsetX: 5, offsetY: -3 })
      expect(c.offsetX).toBe(5)
      expect(c.offsetY).toBe(-3)
    })

    it('accepts friction and restitution', () => {
      const c = createBoxCollider(10, 10, { friction: 0.5, restitution: 0.8 })
      expect(c.friction).toBe(0.5)
      expect(c.restitution).toBe(0.8)
    })

    it('accepts combine rules', () => {
      const c = createBoxCollider(10, 10, { frictionCombineRule: 'max', restitutionCombineRule: 'min' })
      expect(c.frictionCombineRule).toBe('max')
      expect(c.restitutionCombineRule).toBe('min')
    })

    it('accepts group', () => {
      const c = createBoxCollider(10, 10, { group: 'player-parts' })
      expect(c.group).toBe('player-parts')
    })

    it('accepts enabled=false', () => {
      const c = createBoxCollider(10, 10, { enabled: false })
      expect(c.enabled).toBe(false)
    })
  })
})

describe('createCircleCollider', () => {
  it('creates a CircleCollider with given radius', () => {
    const c = createCircleCollider(16)
    expect(c.type).toBe('CircleCollider')
    expect(c.radius).toBe(16)
  })

  describe('default values', () => {
    const c = createCircleCollider(10)

    it('default offsets are 0', () => {
      expect(c.offsetX).toBe(0)
      expect(c.offsetY).toBe(0)
    })

    it('default isTrigger is false', () => {
      expect(c.isTrigger).toBe(false)
    })

    it('default layer is default', () => {
      expect(c.layer).toBe('default')
    })

    it('default mask is *', () => {
      expect(c.mask).toBe('*')
    })

    it('default friction is 0', () => {
      expect(c.friction).toBe(0)
    })

    it('default restitution is 0', () => {
      expect(c.restitution).toBe(0)
    })

    it('default enabled is true', () => {
      expect(c.enabled).toBe(true)
    })

    it('default group is empty string', () => {
      expect(c.group).toBe('')
    })
  })

  describe('custom values', () => {
    it('accepts trigger option', () => {
      const c = createCircleCollider(10, { isTrigger: true })
      expect(c.isTrigger).toBe(true)
    })

    it('accepts layer and mask array', () => {
      const c = createCircleCollider(10, { layer: 'bullets', mask: ['enemies'] })
      expect(c.layer).toBe('bullets')
      expect(c.mask).toEqual(['enemies'])
    })

    it('accepts offsets', () => {
      const c = createCircleCollider(10, { offsetX: 2, offsetY: -5 })
      expect(c.offsetX).toBe(2)
      expect(c.offsetY).toBe(-5)
    })

    it('accepts friction and restitution', () => {
      const c = createCircleCollider(10, { friction: 0.3, restitution: 0.7 })
      expect(c.friction).toBe(0.3)
      expect(c.restitution).toBe(0.7)
    })
  })
})

describe('createCapsuleCollider', () => {
  it('creates a CapsuleCollider with given dimensions', () => {
    const c = createCapsuleCollider(20, 40)
    expect(c.type).toBe('CapsuleCollider')
    expect(c.width).toBe(20)
    expect(c.height).toBe(40)
  })

  describe('default values', () => {
    const c = createCapsuleCollider(10, 20)

    it('default offsets are 0', () => {
      expect(c.offsetX).toBe(0)
      expect(c.offsetY).toBe(0)
    })

    it('default isTrigger is false', () => {
      expect(c.isTrigger).toBe(false)
    })

    it('default layer is default', () => {
      expect(c.layer).toBe('default')
    })

    it('default mask is *', () => {
      expect(c.mask).toBe('*')
    })

    it('default friction is 0', () => {
      expect(c.friction).toBe(0)
    })

    it('default restitution is 0', () => {
      expect(c.restitution).toBe(0)
    })

    it('default enabled is true', () => {
      expect(c.enabled).toBe(true)
    })

    it('default group is empty string', () => {
      expect(c.group).toBe('')
    })
  })

  describe('custom values', () => {
    it('accepts trigger option', () => {
      const c = createCapsuleCollider(10, 20, { isTrigger: true })
      expect(c.isTrigger).toBe(true)
    })

    it('accepts offsets', () => {
      const c = createCapsuleCollider(10, 20, { offsetX: 5, offsetY: 10 })
      expect(c.offsetX).toBe(5)
      expect(c.offsetY).toBe(10)
    })

    it('accepts group', () => {
      const c = createCapsuleCollider(10, 20, { group: 'chain' })
      expect(c.group).toBe('chain')
    })
  })
})

describe('createCompoundCollider', () => {
  it('creates a CompoundCollider with given shapes', () => {
    const shapes = [
      { type: 'box' as const, offsetX: 0, offsetY: 0, width: 20, height: 20 },
      { type: 'circle' as const, offsetX: 10, offsetY: 0, radius: 5 },
    ]
    const c = createCompoundCollider(shapes)
    expect(c.type).toBe('CompoundCollider')
    expect(c.shapes).toHaveLength(2)
    expect(c.shapes[0].type).toBe('box')
    expect(c.shapes[1].type).toBe('circle')
  })

  describe('default values', () => {
    const c = createCompoundCollider([])

    it('default isTrigger is false', () => {
      expect(c.isTrigger).toBe(false)
    })

    it('default layer is default', () => {
      expect(c.layer).toBe('default')
    })

    it('default mask is *', () => {
      expect(c.mask).toBe('*')
    })

    it('default group is empty string', () => {
      expect(c.group).toBe('')
    })
  })

  describe('custom values', () => {
    it('accepts trigger option', () => {
      const c = createCompoundCollider([], { isTrigger: true })
      expect(c.isTrigger).toBe(true)
    })

    it('accepts layer and mask', () => {
      const c = createCompoundCollider([], { layer: 'platform', mask: ['player'] })
      expect(c.layer).toBe('platform')
      expect(c.mask).toEqual(['player'])
    })

    it('accepts group', () => {
      const c = createCompoundCollider([], { group: 'vehicle' })
      expect(c.group).toBe('vehicle')
    })
  })

  describe('shapes', () => {
    it('supports box shapes with width/height', () => {
      const shapes = [{ type: 'box' as const, offsetX: 5, offsetY: 10, width: 30, height: 40 }]
      const c = createCompoundCollider(shapes)
      expect(c.shapes[0]).toEqual({ type: 'box', offsetX: 5, offsetY: 10, width: 30, height: 40 })
    })

    it('supports circle shapes with radius', () => {
      const shapes = [{ type: 'circle' as const, offsetX: 0, offsetY: 0, radius: 15 }]
      const c = createCompoundCollider(shapes)
      expect(c.shapes[0]).toEqual({ type: 'circle', offsetX: 0, offsetY: 0, radius: 15 })
    })

    it('supports empty shapes array', () => {
      const c = createCompoundCollider([])
      expect(c.shapes).toEqual([])
    })
  })
})
