#!/usr/bin/env bash
# Renders public/og.png (1200x630) and the PNG app icons with headless Chrome.
#   npm run og
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

shot() { # html width height output
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=4000 \
    --window-size="$2,$3" --screenshot="$4" "file://$PWD/$1" >/dev/null 2>&1
}

shot scripts/og/og.html 1200 630 public/og.png
for size in 180 512; do
  sed "s/SIZE/$size/g" scripts/og/icon.html > scripts/og/icon-$size.html
  shot scripts/og/icon-$size.html "$size" "$size" "public/icon-$size.png"
  rm scripts/og/icon-$size.html
done
echo "Rendered public/og.png, public/icon-180.png, public/icon-512.png"
