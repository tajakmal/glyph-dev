#!/usr/bin/env bash
set -euo pipefail

secret_pattern='(sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{32,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----|OPENAI_API_KEY[[:space:]]*=|ANTHROPIC_API_KEY[[:space:]]*=|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{20,})'
status=0

tracked_env_files="$(git ls-files | while IFS= read -r file; do
  [[ -e "$file" ]] || continue
  printf '%s\n' "$file"
done | grep -E '(^|/)\.env(\.|$)' | grep -v -E '(^|/)\.env\.template$' || true)"
if [[ -n "$tracked_env_files" ]]; then
  echo "Tracked env files are not allowed:" >&2
  echo "$tracked_env_files" >&2
  status=1
fi

tracked_local_tooling="$(git ls-files | while IFS= read -r file; do
  [[ -e "$file" ]] || continue
  printf '%s\n' "$file"
done | grep -E '^(\.claude/|\.playwright-mcp/|\.codex/)' || true)"
if [[ -n "$tracked_local_tooling" ]]; then
  echo "Tracked local tooling files are not allowed:" >&2
  echo "$tracked_local_tooling" >&2
  status=1
fi

if git grep -n -I -E "$secret_pattern" -- ':!package-lock.json' ':!public/**'; then
  echo "High-confidence secret patterns found in tracked files." >&2
  status=1
fi

while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  case "$file" in
    package-lock.json|public/*) continue ;;
  esac
  if rg -n -I "$secret_pattern" "$file"; then
    echo "High-confidence secret patterns found in untracked file: $file" >&2
    status=1
  fi
done < <(git ls-files --others --exclude-standard)

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

echo "No high-confidence secrets found."
