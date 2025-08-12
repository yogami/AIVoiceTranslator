#!/usr/bin/env bash
set -euo pipefail

# Usage: fetch-piper-voices-build.sh <modelName> [<modelName> ...]
# Example model names:
#   ar_JO-kareem-medium
#   uk_UA-ukrainian-medium
#   ckb_IQ-kurdish_central-medium

DEST_DIR=${PIPER_MODELS_DIR:-"/app/piper_models"}
mkdir -p "$DEST_DIR"

fetch_one() {
  local name="$1"
  local tmp
  tmp=$(mktemp -d)
  local urls=(
    "https://github.com/rhasspy/piper-voices/releases/latest/download/${name}.tar.gz"
    "https://github.com/rhasspy/piper-voices/releases/download/v1.0.0/${name}.tar.gz"
    "https://github.com/rhasspy/piper-voices/releases/download/v0.0.2/${name}.tar.gz"
  )
  local ok=""
  for url in "${urls[@]}"; do
    echo "[Piper Fetch] Trying $url"
    if curl -fsSL "$url" -o "$tmp/model.tgz"; then
      ok="$tmp/model.tgz"
      break
    fi
  done
  if [[ -z "$ok" ]]; then
    echo "[Piper Fetch] WARN: Could not fetch $name (skipping)" >&2
    rm -rf "$tmp"
    return 0
  fi
  tar -xzf "$ok" -C "$tmp" || true
  shopt -s nullglob
  local found=0
  for f in "$tmp"/**/*.onnx "$tmp"/*.onnx; do
    cp "$f" "$DEST_DIR/" && found=1 || true
  done
  for f in "$tmp"/**/*.json "$tmp"/*.json; do
    cp "$f" "$DEST_DIR/" || true
  done
  rm -rf "$tmp"
  if [[ $found -eq 1 ]]; then
    echo "[Piper Fetch] Installed model: $name"
  else
    echo "[Piper Fetch] WARN: No .onnx extracted for $name (skipped)" >&2
  fi
}

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <modelName> [<modelName> ...]" >&2
  exit 1
fi

for m in "$@"; do
  fetch_one "$m"
done

echo "[Piper Fetch] Completed. Models in $DEST_DIR"


