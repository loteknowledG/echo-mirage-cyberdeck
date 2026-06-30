#!/bin/bash
# pkg preinstall — quit + remove old Echo Satellite bundles so upgrade is clean.
pkill -x "Echo-Satellite" 2>/dev/null || true
pkill -x "Echo Satellite" 2>/dev/null || true
pkill -f "Echo-Satellite.app" 2>/dev/null || true
pkill -f "Echo Satellite.app" 2>/dev/null || true
osascript -e 'tell application "Echo-Satellite" to quit' 2>/dev/null || true
osascript -e 'tell application "Echo Satellite" to quit' 2>/dev/null || true
sleep 1
rm -rf "/Applications/Echo-Satellite.app" "/Applications/Echo Satellite.app" 2>/dev/null || true
exit 0
