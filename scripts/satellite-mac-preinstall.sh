#!/bin/bash
# pkg preinstall — quit running Echo Satellite so upgrade can replace the app bundle.
killall "Echo Satellite" 2>/dev/null || true
killall "Echo Satellite Helper" 2>/dev/null || true
killall "Echo Satellite Helper (Renderer)" 2>/dev/null || true
killall "Echo Satellite Helper (GPU)" 2>/dev/null || true
pkill -x "Echo Satellite" 2>/dev/null || true
pkill -f "/Echo Satellite.app/" 2>/dev/null || true
osascript -e 'tell application "Echo Satellite" to quit' 2>/dev/null || true

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! pgrep -f "Echo Satellite" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

exit 0
