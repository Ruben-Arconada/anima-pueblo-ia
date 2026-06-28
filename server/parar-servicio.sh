#!/usr/bin/env bash
# Detiene y elimina los servicios launchd de Ánima (backend + túnel).
# No borra ~/.anima-srv (la copia del backend); bórralo a mano si quieres.
LA="$HOME/Library/LaunchAgents"
UID_N=$(id -u)
launchctl bootout "gui/$UID_N/com.anima.backend" 2>/dev/null || true
launchctl bootout "gui/$UID_N/com.anima.tunnel" 2>/dev/null || true
rm -f "$LA/com.anima.backend.plist" "$LA/com.anima.tunnel.plist"
echo "Servicios de Ánima detenidos y eliminados. El juego seguirá jugable en modo navegador."
echo "(La copia del backend en ~/.anima-srv sigue ahí; bórrala con: rm -rf ~/.anima-srv)"
