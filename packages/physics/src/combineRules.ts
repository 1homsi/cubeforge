/**
 * Friction and restitution coefficient combine rules.
 *
 * When two colliders touch, their material properties must be combined
 * into a single value for the contact. Rapier uses a priority system:
 * Max > Multiply > Min > Average. The higher-priority rule wins.
 */

export type CombineRule = 'average' | 'min' | 'max' | 'multiply'

const RULE_PRIORITY: Record<CombineRule, number> = {
  average: 0,
  min: 1,
  multiply: 2,
  max: 3,
}

/**
 * Combine two coefficients using the higher-priority rule.
 *
 * If both colliders specify the same rule, that rule is used.
 * If they differ, the higher-priority rule wins (Max > Multiply > Min > Average).
 */
export function combineCoefficients(a: number, aRule: CombineRule, b: number, bRule: CombineRule): number {
  const rule = RULE_PRIORITY[aRule] >= RULE_PRIORITY[bRule] ? aRule : bRule
  switch (rule) {
    case 'average':
      return (a + b) / 2
    case 'min':
      return Math.min(a, b)
    case 'max':
      return Math.max(a, b)
    case 'multiply':
      return a * b
  }
}
