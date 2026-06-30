#!/bin/bash
# pkg preinstall — quit running Echo Satellite so upgrade can replace the app bundle.
pkill -x "Echo Satellite" 2>/dev/null || true
pkill -f "Echo Satellite.app" 2>/dev/null || true
osascript -e 'tell application "Echo Satellite" to quit' 2>/dev/null || true
sleep 1
exit 0
