#!/usr/bin/env bash
# uninstall-refresh-launchd.command — remove the daily data-refresh launchd agent.
# Double-click in Finder, or run:  bash wc/scripts/uninstall-refresh-launchd.command
set -uo pipefail
LABEL="com.zwolk.wc2026.refresh-data"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$DEST" 2>/dev/null || true
rm -f "$DEST"
echo "Removed $LABEL (launchd agent unloaded and plist deleted)."
