#!/bin/bash
# Compiles modesto-appshot-helper with the user's Xcode toolchain.
#
# Usage:
#   build.sh [output-directory]
#   MODESTO_APPSHOT_HELPER_OUT=/path build.sh
#
# Defaults to ./build next to this script.

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${1:-${MODESTO_APPSHOT_HELPER_OUT:-$SOURCE_DIR/build}}"
BINARY_NAME="modesto-appshot-helper"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "error: xcrun not found; install the Xcode command line tools" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
OUT_BINARY="$OUT_DIR/$BINARY_NAME"

TMP_BINARY="$(mktemp "${OUT_DIR}/.${BINARY_NAME}.XXXXXX")"
trap 'rm -f "$TMP_BINARY"' EXIT

TARGET_TRIPLE="$(uname -m)-apple-macosx13.0"

xcrun swiftc \
  -O \
  -whole-module-optimization \
  -swift-version 5 \
  -target "$TARGET_TRIPLE" \
  -framework Foundation \
  -framework AppKit \
  -framework ApplicationServices \
  -framework CoreGraphics \
  -framework ImageIO \
  "$SOURCE_DIR/Sources/main.swift" \
  -o "$TMP_BINARY"

chmod +x "$TMP_BINARY"
mv -f "$TMP_BINARY" "$OUT_BINARY"
trap - EXIT

echo "$OUT_BINARY"
