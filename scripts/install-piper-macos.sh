#!/usr/bin/env bash
set -euo pipefail

# Install Piper binary for macOS (x86_64/arm64) and prepare models dir
# Usage: ./scripts/install-piper-macos.sh

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$BASE_DIR/bin"
MODELS_DIR="${PIPER_MODELS_DIR:-$BASE_DIR/piper_models}"
mkdir -p "$BIN_DIR" "$MODELS_DIR"

determine_arch() {
  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64) echo "x86_64" ;;
    arm64) echo "arm64" ;;
    *) echo "unsupported" ;;
  esac
}

ARCH=$(determine_arch)
if [[ "$ARCH" == "unsupported" ]]; then
  echo "Unsupported macOS architecture: $(uname -m)" >&2
  exit 1
fi

# Piper release URLs (pin a known good version)
PIPER_VERSION="0.0.2"
if [[ "$ARCH" == "x86_64" ]]; then
  PIPER_URL="https://github.com/rhasspy/piper/releases/download/v${PIPER_VERSION}/piper_${PIPER_VERSION}_macos_x86_64.tar.gz"
else
  PIPER_URL="https://github.com/rhasspy/piper/releases/download/v${PIPER_VERSION}/piper_${PIPER_VERSION}_macos_arm64.tar.gz"
fi

TMP_DIR=$(mktemp -d)
echo "Downloading Piper ${PIPER_VERSION} for ${ARCH}..."
curl -fL "$PIPER_URL" -o "$TMP_DIR/piper.tgz"
tar -xzf "$TMP_DIR/piper.tgz" -C "$TMP_DIR"

# Find piper binary
FOUND_BIN=$(find "$TMP_DIR" -type f -name piper -perm +111 -print -quit || true)
if [[ -z "$FOUND_BIN" ]]; then
  # fallback to common path
  FOUND_BIN=$(find "$TMP_DIR" -type f -name piper -print -quit || true)
fi
if [[ -z "$FOUND_BIN" ]]; then
  echo "Failed to locate piper binary in downloaded archive" >&2
  exit 1
fi

cp "$FOUND_BIN" "$BIN_DIR/piper"
chmod +x "$BIN_DIR/piper"
echo "Installed Piper to $BIN_DIR/piper"

echo "PIPER_PATH=$BIN_DIR/piper"
echo "PIPER_MODELS_DIR=$MODELS_DIR"
echo "Done. Next: run 'npm run piper:models' to fetch voices."


