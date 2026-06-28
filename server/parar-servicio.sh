#!/usr/bin/env bash
# Detiene y elimina los servicios launchd de Ánima (backend + túnel).
LA="$HOME/Library/LaunchAgents"
launchctl unload -w "$LA/com.anima.backend.plist" 2>/dev/null || true
launchctl unload -w "$LA/com.anima.tunnel.plist" 2>/dev/null || true
rm -f "$LA/com.anima.backend.plist" "$LA/com.anima.tunnel.plist"
echo "Servicios de Ánima detenidos y eliminados. El juego seguirá jugable en modo navegador."
