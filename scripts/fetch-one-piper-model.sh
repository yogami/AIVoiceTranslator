#!/usr/bin/env bash
set -euo pipefail

MODEL_NAME=${1:-}
if [[ -z "$MODEL_NAME" ]]; then
  echo "Usage: $0 <model-name>  # e.g., en_US-amy-medium" >&2
  exit 1
fi

DEST_DIR=${PIPER_MODELS_DIR:-"$(pwd)/piper_models"}
mkdir -p "$DEST_DIR"

TMP_DIR=$(mktemp -d)
URLS=(
  "https://github.com/rhasspy/piper-voices/releases/download/v1.0.0/${MODEL_NAME}.tar.gz"
  "https://github.com/rhasspy/piper-voices/releases/download/v0.0.2/${MODEL_NAME}.tar.gz"
)

downloaded=""
for url in "${URLS[@]}"; do
  echo "Trying $url"
  if curl -fL "$url" -o "$TMP_DIR/model.tgz" ; then
    downloaded="$TMP_DIR/model.tgz"
    break
  fi
done

if [[ -z "$downloaded" ]]; then
  echo "Failed to download model $MODEL_NAME from known URLs" >&2
  exit 1
fi

tar -xzf "$downloaded" -C "$TMP_DIR"
# Move any .onnx/.json found into DEST_DIR
found_any=0
shopt -s nullglob
for f in "$TMP_DIR"/**/*.onnx "$TMP_DIR"/*.onnx ; do
  cp "$f" "$DEST_DIR/" && found_any=1 || true
done
for f in "$TMP_DIR"/**/*.json "$TMP_DIR"/*.json ; do
  cp "$f" "$DEST_DIR/" || true
done

if [[ $found_any -eq 0 ]]; then
  echo "No .onnx files extracted for $MODEL_NAME" >&2
  exit 1
fi

echo "Installed model files for $MODEL_NAME into $DEST_DIR"


