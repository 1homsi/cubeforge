#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PIPELINE_DIR="${PIPELINE_DIR:-.pipeline}"
FEATURE_DIR="$PIPELINE_DIR/features"
PLANS_DIR="${PLANS_DIR:-plans}"

CLAUDE_CMD="${CLAUDE_CMD:-claude}"
CLAUDE_EFFORT="${CLAUDE_EFFORT:-high}"
CLAUDE_MODEL="${CLAUDE_MODEL:-}"

CHECK_TYPECHECK_CMD="${CHECK_TYPECHECK_CMD:-pnpm typecheck}"
CHECK_TEST_CMD="${CHECK_TEST_CMD:-pnpm test}"
CHECK_BUILD_CMD="${CHECK_BUILD_CMD:-pnpm build}"
CHECK_LINT_CMD="${CHECK_LINT_CMD:-pnpm format:check}"
# Replace this with your real e2e command when available.
CHECK_E2E_CMD="${CHECK_E2E_CMD:-pnpm test}"

MAX_CI_FIX_ATTEMPTS="${MAX_CI_FIX_ATTEMPTS:-1}"

usage() {
  cat <<'EOF'
Usage:
  scripts/pipeline.sh feat <name>
  scripts/pipeline.sh code <name>
  scripts/pipeline.sh ship <name>
  scripts/pipeline.sh ci-fix <name>
  scripts/pipeline.sh status <name>

Examples:
  scripts/pipeline.sh feat "camera shake"
  scripts/pipeline.sh code "camera shake"
  scripts/pipeline.sh ship "camera shake"
  scripts/pipeline.sh ci-fix "camera shake"
EOF
}

die() {
  echo "[pipeline] $*" >&2
  exit 1
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

slugify() {
  local raw="$1"
  local slug
  slug="$(echo "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  if [[ -z "$slug" ]]; then
    die "Could not derive a valid feature slug from: $raw"
  fi
  echo "$slug"
}

detect_base_branch() {
  local base
  base="$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p' | head -n 1 || true)"
  if [[ -z "$base" ]]; then
    base="main"
  fi
  echo "$base"
}

BASE_BRANCH="${BASE_BRANCH:-$(detect_base_branch)}"

ensure_tools() {
  have_cmd git || die "git is required"
  have_cmd gh || die "gh CLI is required"
  have_cmd "$CLAUDE_CMD" || die "$CLAUDE_CMD is required"
}

ensure_pipeline_dirs() {
  mkdir -p "$FEATURE_DIR" "$PLANS_DIR"
}

feature_paths() {
  local slug="$1"
  FEATURE_SLUG="$slug"
  FEATURE_BRANCH="feature/$slug"
  FEATURE_ROOT="$FEATURE_DIR/$slug"
  PLAN_FILE="$PLANS_DIR/$slug.md"
  PROMPT_FILE="$FEATURE_ROOT/prompt.md"
  IMPL_REPORT_FILE="$FEATURE_ROOT/impl-report.md"
  PR_BODY_FILE="$FEATURE_ROOT/pr-body.md"
  LAST_CI_LOG_FILE="$FEATURE_ROOT/last-ci-failure.log"
  LAST_CI_PROMPT_FILE="$FEATURE_ROOT/ci-fix-prompt.md"
  LAST_CI_REPORT_FILE="$FEATURE_ROOT/ci-fix-report.md"
}

ensure_branch() {
  local branch="$1"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git checkout "$branch" >/dev/null
  else
    git checkout -b "$branch" >/dev/null
  fi
}

ensure_plan_exists() {
  [[ -f "$PLAN_FILE" ]] || die "Missing plan file: $PLAN_FILE. Run feat first."
}

run_gate() {
  local label="$1"
  local cmd="$2"
  echo "[pipeline] running $label: $cmd"
  bash -lc "$cmd"
}

run_all_gates() {
  run_gate "typecheck" "$CHECK_TYPECHECK_CMD"
  run_gate "test" "$CHECK_TEST_CMD"
  run_gate "build" "$CHECK_BUILD_CMD"
  run_gate "lint" "$CHECK_LINT_CMD"
  run_gate "e2e" "$CHECK_E2E_CMD"
}

run_claude_prompt() {
  local prompt_file="$1"
  local report_file="$2"
  local prompt_text
  prompt_text="$(cat "$prompt_file")"

  local -a args
  args=(--print --dangerously-skip-permissions --effort "$CLAUDE_EFFORT")
  if [[ -n "$CLAUDE_MODEL" ]]; then
    args+=(--model "$CLAUDE_MODEL")
  fi

  echo "[pipeline] running Claude with prompt: $prompt_file"
  "$CLAUDE_CMD" "${args[@]}" "$prompt_text" | tee "$report_file"
}

write_plan_template() {
  local slug="$1"
  cat >"$PLAN_FILE" <<EOF
# $slug

## Problem
- What is the user-facing problem?

## Scope
- What should be included?
- What should not be included?

## Constraints
- Blocking questions must be answered before implementation.
- Keep existing architecture and coding style.

## Acceptance Criteria
1. Define exact expected behavior.
2. Define edge cases.
3. Define failure behavior.

## Test Plan
- typecheck
- test
- build
- lint
- e2e

## Notes For Claude
- Do not ask follow-up questions during implementation.
- Implement directly from this plan.
EOF
}

write_impl_prompt() {
  cat >"$PROMPT_FILE" <<EOF
You are Claude Code operating in this repository.

Context:
- Feature slug: $FEATURE_SLUG
- Branch: $FEATURE_BRANCH
- Plan file: $PLAN_FILE
- Repository root: $ROOT_DIR

Hard requirements:
1) Read the entire plan file first and implement exactly that scope.
2) Do not ask questions; treat the plan as complete.
3) Make code changes directly in the current repository.
4) After implementation, run and pass these commands:
   - $CHECK_TYPECHECK_CMD
   - $CHECK_TEST_CMD
   - $CHECK_BUILD_CMD
   - $CHECK_LINT_CMD
   - $CHECK_E2E_CMD
5) If any command fails, fix and re-run until all pass.
6) Do not commit or push.

Return format:
- Summary
- Files changed
- Verification results (each command + pass/fail)
- Risks / follow-ups

Plan:
\`\`\`markdown
$(cat "$PLAN_FILE")
\`\`\`
EOF
}

write_ci_fix_prompt() {
  cat >"$LAST_CI_PROMPT_FILE" <<EOF
You are Claude Code operating in this repository.

Task:
- Fix failing CI for feature "$FEATURE_SLUG" on branch "$FEATURE_BRANCH".
- Use the failing GitHub Actions logs below.

Requirements:
1) Apply only targeted fixes for CI failures.
2) Run and pass these commands locally:
   - $CHECK_TYPECHECK_CMD
   - $CHECK_TEST_CMD
   - $CHECK_BUILD_CMD
   - $CHECK_LINT_CMD
   - $CHECK_E2E_CMD
3) Do not commit or push.

Return format:
- Root cause
- Fix summary
- Files changed
- Verification results

Plan:
\`\`\`markdown
$(cat "$PLAN_FILE")
\`\`\`

Failed CI log excerpt:
\`\`\`
$(sed -n '1,2000p' "$LAST_CI_LOG_FILE")
\`\`\`
EOF
}

commit_all_changes() {
  local message="$1"
  git add -A
  if git diff --cached --quiet; then
    die "No staged changes to commit"
  fi
  git commit -m "$message"
}

make_commit_message() {
  local type="$1"
  local title
  title="$(sed -n '1s/^# *//p' "$PLAN_FILE" | tr -s ' ' | sed 's/[[:space:]]*$//')"
  if [[ -z "$title" ]]; then
    title="$FEATURE_SLUG"
  fi
  echo "$type($FEATURE_SLUG): $title"
}

build_pr_body() {
  local report_snippet=""
  if [[ -f "$IMPL_REPORT_FILE" ]]; then
    report_snippet="$(sed -n '1,120p' "$IMPL_REPORT_FILE")"
  fi

  cat >"$PR_BODY_FILE" <<EOF
## Feature Plan
\`\`\`markdown
$(cat "$PLAN_FILE")
\`\`\`

## Implementation Summary
\`\`\`
$report_snippet
\`\`\`

## Local Verification
- [x] $CHECK_TYPECHECK_CMD
- [x] $CHECK_TEST_CMD
- [x] $CHECK_BUILD_CMD
- [x] $CHECK_LINT_CMD
- [x] $CHECK_E2E_CMD
EOF
}

create_or_update_pr() {
  local title="$1"
  build_pr_body
  local existing_pr
  existing_pr="$(gh pr list --head "$FEATURE_BRANCH" --json number --jq '.[0].number' 2>/dev/null || true)"
  if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
    gh pr edit "$existing_pr" --title "$title" --body-file "$PR_BODY_FILE" >/dev/null
    gh pr view "$existing_pr" --json url --jq '.url'
    return
  fi
  gh pr create --base "$BASE_BRANCH" --head "$FEATURE_BRANCH" --title "$title" --body-file "$PR_BODY_FILE"
}

latest_run_id_for_branch() {
  gh run list --branch "$FEATURE_BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId'
}

show_status() {
  local run_id status conclusion url
  run_id="$(latest_run_id_for_branch 2>/dev/null || true)"
  if [[ -z "$run_id" || "$run_id" == "null" ]]; then
    echo "[pipeline] no CI runs yet for $FEATURE_BRANCH"
  else
    status="$(gh run view "$run_id" --json status --jq '.status')"
    conclusion="$(gh run view "$run_id" --json conclusion --jq '.conclusion')"
    url="$(gh run view "$run_id" --json url --jq '.url')"
    echo "[pipeline] latest run: $run_id"
    echo "[pipeline] status: $status / $conclusion"
    echo "[pipeline] url: $url"
  fi

  local conclusions
  conclusions="$(gh run list --branch "$FEATURE_BRANCH" --limit 6 --json conclusion --jq '.[].conclusion' 2>/dev/null || true)"
  if echo "$conclusions" | grep -q '^success$' && echo "$conclusions" | grep -q '^failure$'; then
    echo "[pipeline] flag: possible flaky CI (mixed success/failure in recent runs)"
  fi
}

cmd_feat() {
  local raw_name="$1"
  local slug
  slug="$(slugify "$raw_name")"
  feature_paths "$slug"
  ensure_pipeline_dirs

  mkdir -p "$FEATURE_ROOT"
  ensure_branch "$FEATURE_BRANCH"

  if [[ ! -f "$PLAN_FILE" ]]; then
    write_plan_template "$slug"
    echo "[pipeline] created plan template: $PLAN_FILE"
  else
    echo "[pipeline] plan already exists: $PLAN_FILE"
  fi

  echo "[pipeline] ready on branch: $FEATURE_BRANCH"
}

cmd_code() {
  local raw_name="$1"
  local slug
  slug="$(slugify "$raw_name")"
  feature_paths "$slug"
  ensure_pipeline_dirs
  ensure_branch "$FEATURE_BRANCH"
  ensure_plan_exists

  mkdir -p "$FEATURE_ROOT"
  write_impl_prompt
  run_claude_prompt "$PROMPT_FILE" "$IMPL_REPORT_FILE"

  echo "[pipeline] implementation report: $IMPL_REPORT_FILE"
}

cmd_ship() {
  local raw_name="$1"
  local slug
  slug="$(slugify "$raw_name")"
  feature_paths "$slug"
  ensure_pipeline_dirs
  ensure_branch "$FEATURE_BRANCH"
  ensure_plan_exists

  run_all_gates
  local commit_msg
  commit_msg="$(make_commit_message "feat")"
  commit_all_changes "$commit_msg"
  git push -u origin "$FEATURE_BRANCH"
  local pr_url
  pr_url="$(create_or_update_pr "$commit_msg")"

  echo "[pipeline] pushed: $FEATURE_BRANCH"
  echo "[pipeline] pr: $pr_url"
}

cmd_ci_fix() {
  local raw_name="$1"
  local slug
  slug="$(slugify "$raw_name")"
  feature_paths "$slug"
  ensure_pipeline_dirs
  ensure_branch "$FEATURE_BRANCH"
  ensure_plan_exists

  local attempt=1
  while (( attempt <= MAX_CI_FIX_ATTEMPTS )); do
    local run_id status conclusion
    run_id="$(latest_run_id_for_branch)"
    [[ -n "$run_id" && "$run_id" != "null" ]] || die "No CI run found for branch $FEATURE_BRANCH"

    status="$(gh run view "$run_id" --json status --jq '.status')"
    conclusion="$(gh run view "$run_id" --json conclusion --jq '.conclusion')"

    if [[ "$status" != "completed" ]]; then
      echo "[pipeline] latest CI run is still $status, try again later"
      return 0
    fi

    if [[ "$conclusion" == "success" ]]; then
      echo "[pipeline] CI is already green"
      return 0
    fi

    if [[ "$conclusion" != "failure" ]]; then
      die "CI run is completed with conclusion=$conclusion (manual judgment required)"
    fi

    mkdir -p "$FEATURE_ROOT"
    gh run view "$run_id" --log-failed >"$LAST_CI_LOG_FILE" || gh run view "$run_id" --log >"$LAST_CI_LOG_FILE"

    write_ci_fix_prompt
    run_claude_prompt "$LAST_CI_PROMPT_FILE" "$LAST_CI_REPORT_FILE"

    run_all_gates
    commit_all_changes "fix(ci): resolve failing checks for $FEATURE_SLUG (run $run_id)"
    git push

    attempt=$((attempt + 1))
  done

  echo "[pipeline] reached MAX_CI_FIX_ATTEMPTS=$MAX_CI_FIX_ATTEMPTS"
}

cmd_status() {
  local raw_name="$1"
  local slug
  slug="$(slugify "$raw_name")"
  feature_paths "$slug"
  if git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH"; then
    git checkout "$FEATURE_BRANCH" >/dev/null
  fi
  show_status
}

main() {
  ensure_tools
  if [[ $# -lt 2 ]]; then
    usage
    exit 1
  fi

  local command="$1"
  local feature_name="$2"

  case "$command" in
    feat) cmd_feat "$feature_name" ;;
    code) cmd_code "$feature_name" ;;
    ship) cmd_ship "$feature_name" ;;
    ci-fix) cmd_ci_fix "$feature_name" ;;
    status) cmd_status "$feature_name" ;;
    *)
      usage
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"
