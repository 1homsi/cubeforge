# Feature Plans

Each feature should have one file:

- `plans/<feature-slug>.md`

This file is the single source of truth for automated implementation.

Minimum sections:

1. Problem
2. Scope
3. Constraints
4. Acceptance Criteria
5. Test Plan
6. Notes For Claude

The pipeline reads this file to generate the implementation and CI-fix prompts.
