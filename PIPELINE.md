# Automation Pipeline

This repository now includes a minimal automation pipeline for feature delivery.

## Commands

Use `make`:

```bash
make feat NAME="camera-shake"
make code NAME="camera-shake"
make ship NAME="camera-shake"
make ci-fix NAME="camera-shake"
make status NAME="camera-shake"
```

Or run directly:

```bash
scripts/pipeline.sh feat "camera-shake"
scripts/pipeline.sh code "camera-shake"
scripts/pipeline.sh ship "camera-shake"
scripts/pipeline.sh ci-fix "camera-shake"
scripts/pipeline.sh status "camera-shake"
```

## What each step does

1. `feat`: creates branch `feature/<slug>` and a plan template in `plans/<slug>.md`.
2. `code`: generates a Claude prompt from the plan and runs Claude Code CLI.
3. `ship`: runs local gates, commits, pushes, and opens/updates PR.
4. `ci-fix`: reads failed GitHub Actions logs, runs Claude fix, re-checks, commits, pushes.
5. `status`: shows latest CI state and flags possible flaky CI.

## Config (optional env vars)

- `CLAUDE_CMD` (default: `claude`)
- `CLAUDE_EFFORT` (default: `high`)
- `CLAUDE_MODEL` (optional)
- `BASE_BRANCH` (default: remote HEAD branch)
- `CHECK_TYPECHECK_CMD` (default: `pnpm typecheck`)
- `CHECK_TEST_CMD` (default: `pnpm test`)
- `CHECK_BUILD_CMD` (default: `pnpm build`)
- `CHECK_LINT_CMD` (default: `pnpm format:check`)
- `CHECK_E2E_CMD` (default: `pnpm test`, replace with real e2e command)
- `MAX_CI_FIX_ATTEMPTS` (default: `1`)
