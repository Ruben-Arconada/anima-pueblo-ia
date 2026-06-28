#!/usr/bin/env bash
# ============================================================================
# Instala Ánima (backend 7B + túnel Cloudflare) como SERVICIOS launchd:
#   - se auto-reinician si se caen (KeepAlive)
#   - arrancan solos al encender el Mac (RunAtLoad)
#   - sobreviven a cerrar la terminal y a esta sesión de Claude
#
# EJECÚTALO TÚ: expone tu Ollama a internet por un túnel protegido con token.
# Parar/quitar:  ./parar-servicio.sh
#
# OJO: el túnel "quick" (trycloudflare) da una URL ALEATORIA que cambia cada vez
# que cloudflared reinicia (incluido al reiniciar el Mac). Para una URL que NO
# cambie nunca, usa un TÚNEL CON NOMBRE (ver el bloque comentado al final).
# ============================================================================
set -e
DIR="$HOME/Documents/juego-ia/app/server"
LA="$HOME/Library/LaunchAgents"
PAGES="https://ruben-arconada.github.io/anima-pueblo-ia"
mkdir -p "$LA"

TOKEN=$(cat "$DIR/.token" 2>/dev/null || cat /tmp/anima-token.txt 2>/dev/null || openssl rand -hex 12)
echo "$TOKEN" > "$DIR/.token"
CF=$(command -v cloudflared || echo /opt/homebrew/bin/cloudflared)

cat > "$LA/com.anima.backend.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.anima.backend</string>
  <key>ProgramArguments</key><array>
    <string>$DIR/.venv/bin/uvicorn</string>
    <string>anima_server:app</string>
    <string>--host</string><string>0.0.0.0</string><string>--port</string><string>8011</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>ANIMA_TOKEN</key><string>$TOKEN</string>
    <key>ANIMA_KEEPALIVE</key><string>30m</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/anima-backend.log</string>
  <key>StandardErrorPath</key><string>/tmp/anima-backend.log</string>
</dict></plist>
PLIST

cat > "$LA/com.anima.tunnel.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.anima.tunnel</string>
  <key>ProgramArguments</key><array>
    <string>$CF</string><string>tunnel</string><string>--url</string><string>http://localhost:8011</string>
  </array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/anima-tunnel.log</string>
  <key>StandardErrorPath</key><string>/tmp/anima-tunnel.log</string>
</dict></plist>
PLIST

launchctl unload "$LA/com.anima.backend.plist" 2>/dev/null || true
launchctl unload "$LA/com.anima.tunnel.plist" 2>/dev/null || true
: > /tmp/anima-tunnel.log
launchctl load -w "$LA/com.anima.backend.plist"
launchctl load -w "$LA/com.anima.tunnel.plist"

echo "Servicios cargados. Esperando la URL del túnel..."
URL=""
for i in $(seq 1 20); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/anima-tunnel.log 2>/dev/null | head -1)
  [ -n "$URL" ] && break
  sleep 2
done

echo "────────────────────────────────────────────"
echo "  Token:  $TOKEN"
echo "  Túnel:  ${URL:-(revisa /tmp/anima-tunnel.log)}"
echo "  Jugar con tu 7B:"
echo "  $PAGES/?ia=$URL&k=$TOKEN"
echo "────────────────────────────────────────────"

# ── PARA UNA URL ESTABLE (no cambia nunca) — túnel con NOMBRE ───────────────
#   Necesita tu cuenta Cloudflare y un dominio en ella. Una sola vez:
#     cloudflared login
#     cloudflared tunnel create anima
#     cloudflared tunnel route dns anima anima.TUDOMINIO.com
#   Luego apunta el plist com.anima.tunnel a:  tunnel run anima
#   y usarás SIEMPRE  ?ia=https://anima.TUDOMINIO.com&k=TOKEN
