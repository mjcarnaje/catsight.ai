#!/usr/bin/env bash
# Serve Marker 2's OCR model (Surya OCR 2) on this Mac's GPU with llama.cpp, as a
# launchd agent that the CATSight containers reach at host.docker.internal.
# Docker on macOS can't use the GPU; on the CPU the `ocr` container (profile
# ocr-cpu) needs ~2 minutes per page, the GPU ~15-20 seconds.
#
# Run on the server, then set in .env.prod and redeploy:
#   SURYA_INFERENCE_URL=http://host.docker.internal:8791/v1
#
#   ./scripts/install-ocr-service.sh              install or update, then wait until ready
#   OCR_PORT=8792 ./scripts/install-ocr-service.sh
set -euo pipefail

port="${OCR_PORT:-8791}"
label="com.catsight.ocr"
plist="$HOME/Library/LaunchAgents/$label.plist"
log="$HOME/Library/Logs/catsight-ocr.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

command -v llama-server >/dev/null || brew install llama.cpp
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

# Same options Surya would pass if it started the server itself (alias, chat
# template, 12,288 tokens of context per slot). Loopback only: nothing on the LAN.
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v llama-server)</string>
    <string>--hf-repo</string><string>datalab-to/surya-ocr-2-gguf</string>
    <string>--hf-file</string><string>surya-2.gguf</string>
    <string>--mmproj-url</string><string>https://huggingface.co/datalab-to/surya-ocr-2-gguf/resolve/main/surya-2-mmproj.gguf</string>
    <string>--alias</string><string>datalab-to/surya-ocr-2</string>
    <string>--jinja</string>
    <string>-ngl</string><string>99</string>
    <string>--host</string><string>127.0.0.1</string>
    <string>--port</string><string>$port</string>
    <string>--parallel</string><string>2</string>
    <string>--ctx-size</string><string>24576</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"

echo "Starting; the first run downloads the model (~1.5 GB) into ~/Library/Caches/llama.cpp"
for _ in $(seq 1 180); do
  if curl -sf "http://127.0.0.1:$port/health" >/dev/null; then
    echo "OCR server ready on 127.0.0.1:$port"
    exit 0
  fi
  sleep 5
done
echo "Not ready after 15 minutes; see $log" >&2
exit 1
