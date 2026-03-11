import { describe, it, expect, vi, afterEach } from 'vitest'
import { arrive, flee, patrol, seek, wander, pursuit, evade, separation, cohesion, alignment } from '../nav/steering'

describe('steering', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('seek', () => {
    it('moves toward the target at full speed', () => {
      const vel = seek({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)

      expect(vel.x).toBeCloseTo(6)
      expect(vel.y).toBeCloseTo(8)
    })

    it('returns zero velocity when already at the target', () => {
      expect(seek({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual({ x: 0, y: 0 })
    })
  })

  describe('flee', () => {
    it('moves away from the threat at full speed', () => {
      const vel = flee({ x: 3, y: 4 }, { x: 0, y: 0 }, 5)

      expect(vel.x).toBeCloseTo(3)
      expect(vel.y).toBeCloseTo(4)
    })

    it('returns zero velocity when already at the threat position', () => {
      expect(flee({ x: 2, y: 2 }, { x: 2, y: 2 }, 7)).toEqual({ x: 0, y: 0 })
    })
  })

  describe('arrive', () => {
    it('moves at full speed outside the slow radius', () => {
      const vel = arrive({ x: 0, y: 0 }, { x: 30, y: 40 }, 5, 10)

      expect(vel.x).toBeCloseTo(3)
      expect(vel.y).toBeCloseTo(4)
    })

    it('slows down proportionally inside the slow radius', () => {
      const vel = arrive({ x: 0, y: 0 }, { x: 3, y: 4 }, 10, 10)

      expect(vel.x).toBeCloseTo(3)
      expect(vel.y).toBeCloseTo(4)
    })

    it('returns zero velocity at the target', () => {
      expect(arrive({ x: 4, y: 4 }, { x: 4, y: 4 }, 10, 20)).toEqual({ x: 0, y: 0 })
    })

    it('preserves direction while slowing down', () => {
      const vel = arrive({ x: 10, y: 10 }, { x: 13, y: 10 }, 12, 6)

      expect(vel.x).toBeCloseTo(6)
      expect(vel.y).toBeCloseTo(0)
    })
  })

  describe('patrol', () => {
    it('returns zero velocity for an empty waypoint list', () => {
      expect(patrol({ x: 0, y: 0 }, [], 5, 3)).toEqual({
        vel: { x: 0, y: 0 },
        nextIdx: 0,
      })
    })

    it('moves toward the current waypoint', () => {
      const result = patrol(
        { x: 0, y: 0 },
        [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        4,
        0,
      )

      expect(result.vel).toEqual({ x: 4, y: 0 })
      expect(result.nextIdx).toBe(0)
    })

    it('advances to the next waypoint when within the threshold', () => {
      const result = patrol(
        { x: 9, y: 0 },
        [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        3,
        0,
        2,
      )

      expect(result.nextIdx).toBe(1)
      expect(result.vel).toEqual({ x: 3, y: 0 })
    })

    it('wraps to the first waypoint after the last one', () => {
      const result = patrol(
        { x: 20, y: 1 },
        [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        2,
        1,
        2,
      )

      expect(result.nextIdx).toBe(0)
    })

    it('uses modulo indexing for current waypoint selection', () => {
      const result = patrol(
        { x: 0, y: 0 },
        [
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
        5,
        3,
      )

      expect(result.vel.x).toBeCloseTo(0)
      expect(result.vel.y).toBeCloseTo(5)
      expect(result.nextIdx).toBe(3)
    })
  })

  describe('wander', () => {
    it('returns a velocity with the requested magnitude', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1)

      const result = wander({ x: 0, y: 0 }, 0, 6, 0.5)

      expect(result.newAngle).toBeCloseTo(0.5)
      expect(Math.hypot(result.vel.x, result.vel.y)).toBeCloseTo(6)
    })

    it('can rotate in the negative direction', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)

      const result = wander({ x: 0, y: 0 }, 1, 3, 0.25)

      expect(result.newAngle).toBeCloseTo(0.75)
      expect(result.vel.x).toBeCloseTo(Math.cos(0.75) * 3)
      expect(result.vel.y).toBeCloseTo(Math.sin(0.75) * 3)
    })

    it('keeps the same angle when jitter is zero', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9)

      const result = wander({ x: 5, y: 5 }, Math.PI / 2, 2, 0)

      expect(result.newAngle).toBeCloseTo(Math.PI / 2)
      expect(result.vel.x).toBeCloseTo(0)
      expect(result.vel.y).toBeCloseTo(2)
    })
  })

  describe('pursuit', () => {
    it('steers toward a stationary target the same as seek', () => {
      const vel = pursuit({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 5, 0.5)
      expect(vel.x).toBeCloseTo(5)
      expect(vel.y).toBeCloseTo(0)
    })

    it('leads a target moving away — predicted position is ahead of current', () => {
      // Target at (10,0) moving right at 20px/s, lookAhead=1s → predict (30,0)
      const vel = pursuit({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, 5, 1)
      // Should aim toward (30,0) not (10,0) — still pointing right but full speed
      expect(vel.x).toBeCloseTo(5)
      expect(vel.y).toBeCloseTo(0)
    })

    it('has correct speed magnitude', () => {
      const vel = pursuit({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 1, y: 0 }, 10, 0.5)
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(10)
    })

    it('returns zero when predicted position equals self', () => {
      // Target at (2,0) moving toward us at -2/s with lookAhead=1 → predicted at (0,0)
      const vel = pursuit({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -2, y: 0 }, 5, 1)
      expect(vel).toEqual({ x: 0, y: 0 })
    })
  })

  describe('evade', () => {
    it('flees from a stationary threat the same as flee', () => {
      const vel = evade({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 5, 0)
      expect(vel.x).toBeCloseTo(3)
      expect(vel.y).toBeCloseTo(4)
    })

    it('flees from a threat predicted position', () => {
      // Threat at (0,0) moving right at 5/s, lookAhead=1 → predicted at (5,0)
      // Self at (10,0) — should flee from (5,0), i.e. go right
      const vel = evade({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, 4, 1)
      expect(vel.x).toBeCloseTo(4)
      expect(vel.y).toBeCloseTo(0)
    })

    it('has correct speed magnitude', () => {
      const vel = evade({ x: 10, y: 0 }, { x: 0, y: 5 }, { x: 0, y: 0 }, 7, 0.5)
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(7)
    })
  })

  describe('separation', () => {
    it('returns zero with no neighbors', () => {
      expect(separation({ x: 0, y: 0 }, [], 5, 50)).toEqual({ x: 0, y: 0 })
    })

    it('pushes away from a single neighbor', () => {
      // Neighbor directly below
      const vel = separation({ x: 0, y: 0 }, [{ x: 0, y: 10 }], 5, 50)
      expect(vel.x).toBeCloseTo(0)
      expect(vel.y).toBeLessThan(0) // push upward
    })

    it('ignores neighbors beyond the radius', () => {
      const vel = separation({ x: 0, y: 0 }, [{ x: 0, y: 100 }], 5, 50)
      expect(vel).toEqual({ x: 0, y: 0 })
    })

    it('result has the requested speed magnitude when neighbors are close', () => {
      const vel = separation({ x: 0, y: 0 }, [{ x: 10, y: 0 }], 6, 50)
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(6)
    })

    it('averages push direction from multiple neighbors', () => {
      // Two neighbors: one left, one right → net force cancels → zero
      const vel = separation(
        { x: 0, y: 0 },
        [
          { x: -10, y: 0 },
          { x: 10, y: 0 },
        ],
        5,
        50,
      )
      expect(vel.x).toBeCloseTo(0)
      expect(vel.y).toBeCloseTo(0)
    })
  })

  describe('cohesion', () => {
    it('returns zero with no neighbors', () => {
      expect(cohesion({ x: 0, y: 0 }, [], 5)).toEqual({ x: 0, y: 0 })
    })

    it('seeks the centroid of neighbors', () => {
      // Single neighbor at (10,0) → steer right
      const vel = cohesion({ x: 0, y: 0 }, [{ x: 10, y: 0 }], 4)
      expect(vel.x).toBeCloseTo(4)
      expect(vel.y).toBeCloseTo(0)
    })

    it('computes the correct centroid for multiple neighbors', () => {
      // Two neighbors at (-10,0) and (10,0) → centroid at (0,0) = self → zero vel
      const vel = cohesion(
        { x: 0, y: 0 },
        [
          { x: -10, y: 0 },
          { x: 10, y: 0 },
        ],
        5,
      )
      expect(vel).toEqual({ x: 0, y: 0 })
    })

    it('has correct speed magnitude', () => {
      const vel = cohesion({ x: 0, y: 0 }, [{ x: 3, y: 4 }], 10)
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(10)
    })
  })

  describe('alignment', () => {
    it('returns zero with no neighbors', () => {
      expect(alignment([], 5)).toEqual({ x: 0, y: 0 })
    })

    it('matches a single neighbor velocity direction', () => {
      // Neighbor moving right → align moving right
      const vel = alignment([{ x: 10, y: 0 }], 5)
      expect(vel.x).toBeCloseTo(5)
      expect(vel.y).toBeCloseTo(0)
    })

    it('averages directions of multiple neighbors', () => {
      // One up, one right → 45° diagonal
      const vel = alignment(
        [
          { x: 0, y: -10 },
          { x: 10, y: 0 },
        ],
        4,
      )
      expect(vel.x).toBeGreaterThan(0)
      expect(vel.y).toBeLessThan(0)
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(4)
    })

    it('cancels when neighbors move in opposite directions', () => {
      // One left, one right → zero net
      const vel = alignment(
        [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
        4,
      )
      expect(vel).toEqual({ x: 0, y: 0 })
    })

    it('has correct speed magnitude', () => {
      const vel = alignment(
        [
          { x: 3, y: 4 },
          { x: 0, y: 10 },
        ],
        7,
      )
      expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(7)
    })
  })
})
