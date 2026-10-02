#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
model_dir="$project_root/apps/api/.ocr-data"
mkdir -p "$model_dir"
for language in eng chi_sim; do
  if [ -s "$model_dir/$language.traineddata" ]; then continue; fi
  curl --fail --location --connect-timeout 10 --max-time 600 --retry 1 "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/$language.traineddata" --output "$model_dir/$language.traineddata.part"
  mv "$model_dir/$language.traineddata.part" "$model_dir/$language.traineddata"
done
