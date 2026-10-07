#!/usr/bin/env bash
# Shared platform selection, sourced by setup.sh, pull-llms.sh and migrate.sh.
#
#   ./setup.sh mac   -> CPU torch           (docker-compose.mac.yml)
#   ./setup.sh pc    -> NVIDIA GPU + CUDA   (docker-compose.pc.yml)
#   ./setup.sh       -> auto-detect
#
# Exports COMPOSE_FILES for use as: docker compose $COMPOSE_FILES ...

PLATFORM="${1:-${CATSIGHT_PLATFORM:-}}"

if [[ -z "$PLATFORM" ]]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="mac"
  elif command -v nvidia-smi &> /dev/null; then
    # Linux, or Windows via Git Bash/WSL with an NVIDIA driver
    PLATFORM="pc"
  else
    PLATFORM="mac"  # no NVIDIA GPU: fall back to the CPU setup
  fi
fi

case "$PLATFORM" in
  mac) echo "💻  Platform: mac (CPU)" ;;
  pc)  echo "🎮  Platform: pc (NVIDIA GPU)" ;;
  *)   echo "❌ Unknown platform '$PLATFORM' (use 'mac' or 'pc')"; exit 1 ;;
esac

export CATSIGHT_PLATFORM="$PLATFORM"
export COMPOSE_FILES="-f docker-compose.yml -f docker-compose.$PLATFORM.yml"
