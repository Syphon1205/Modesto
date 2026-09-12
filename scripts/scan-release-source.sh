#!/usr/bin/env bash
set -euo pipefail

# Scan the exact committed snapshot, not checkout credentials or private refs.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
scan_dir="$(mktemp -d)"
trap 'rm -rf "$scan_dir"' EXIT
git archive HEAD | tar -x -C "$scan_dir"

if [[ ! -f "$scan_dir/.gitleaks.toml" && -f "$repo_root/.gitleaks.toml" ]]; then
  cp "$repo_root/.gitleaks.toml" "$scan_dir/.gitleaks.toml"
fi

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks dir "$scan_dir" --config "$scan_dir/.gitleaks.toml" --redact --no-banner
else
  docker run --rm -v "$scan_dir:/source:ro" \
    ghcr.io/gitleaks/gitleaks:v8.30.0 \
    dir /source --config /source/.gitleaks.toml --redact --no-banner
fi
