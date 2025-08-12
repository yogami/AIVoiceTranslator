#!/usr/bin/env bash
set -euo pipefail

# Destination directory for Piper models
DEST_DIR=${PIPER_MODELS_DIR:-"$(pwd)/piper_models"}
mkdir -p "$DEST_DIR"

# Minimal curated set for EU + immigrant languages common in Germany
# Filenames are typical; adjust as needed to exact filenames from rhasspy/piper releases
MODELS=(
  # Core EU set
  "en_US-amy-medium.onnx"
  "en_GB-northern_english_male-medium.onnx"
  "de_DE-thorsten-medium.onnx"
  "fr_FR-gilles-medium.onnx"
  "es_ES-ana-medium.onnx"
  "it_IT-riccardo-xlow.onnx"
  "pt_BR-edresson-medium.onnx"
  "nl_NL-mls-medium.onnx"
  "sv_SE-nst-medium.onnx"
  "da_DK-nst-medium.onnx"
  "no_NO-nst-medium.onnx"
  "fi_FI-tnc-medium.onnx"
  "pl_PL-gosia-medium.onnx"
  "cs_CZ-krystof-medium.onnx"
  "hu_HU-anna-medium.onnx"
  "ro_RO-mihai-medium.onnx"
  "ru_RU-ruslan-medium.onnx"
  "uk_UA-ukrainian-medium.onnx"
  "tr_TR-dfki-medium.onnx"
  "el_GR-nikolaos-medium.onnx"
  "bg_BG-dfki-medium.onnx"
  "sr_RS-serbian-medium.onnx"
  "hr_HR-croatian-medium.onnx"
  "sk_SK-dfki-medium.onnx"

  # Middle Eastern / immigrant languages
  "ar_JO-kareem-medium.onnx"
  "fa_IR-ava-medium.onnx"
  "ckb_IQ-kurdish_central-medium.onnx"
  "ku_TR-kurdish-medium.onnx"
  "ps_AF-pashto-medium.onnx"
  "ur_PK-urdu-medium.onnx"
)

BASE_URL=${PIPER_MODELS_BASE:-"https://github.com/rhasspy/piper/releases/download/v0.0.2"}

echo "Fetching Piper models into $DEST_DIR"
for file in "${MODELS[@]}"; do
  url="$BASE_URL/$file"
  dest="$DEST_DIR/$file"
  if [[ -f "$dest" ]]; then
    echo "[skip] $file exists"
    continue
  fi
  echo "[get] $url"
  curl -fL "$url" -o "$dest"
done

echo "Done. Models in: $DEST_DIR"


