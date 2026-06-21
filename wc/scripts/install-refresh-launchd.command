#!/usr/bin/env bash
# install-refresh-launchd.command — install the daily data-refresh launchd agent.
# Double-click in Finder, or run:  bash wc/scripts/install-refresh-launchd.command
# User-scoped, no sudo. Reverse with uninstall-refresh-launchd.command.
set -euo pipefail
LABEL="com.zwolk.wc2026.refresh-data"
SRC="/Users/zacharywolk/zwolk/wc/scripts/${LABEL}.plist"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

chmod +x /Users/zacharywolk/zwolk/wc/scripts/refresh-data
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SRC" "$DEST"

# Unload an older copy if present, then load fresh (try modern then legacy form).
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$DEST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST" 2>/dev/null || launchctl load -w "$DEST"

echo "Installed $LABEL — runs daily at 06:30 local."
echo "Logs: /Users/zacharywolk/zwolk/wc/scripts/refresh-data.log"
echo "Verify: launchctl list | grep $LABEL"
