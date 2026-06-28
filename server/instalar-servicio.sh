#!/usr/bin/env bash
# ============================================================================
# Instala Ánima (backend 7B + túnel Cloudflare) como SERVICIOS launchd
# PERSISTENTES: se auto-reinician, arrancan al encender el Mac y sobreviven a
# cerrar la terminal / la sesión de Claude.
#
# IMPORTANTE (macOS): los servicios launchd NO pueden leer ~/Documents (TCC).
# Por eso este script copia el backend + los datos a ~/.anima-srv (fuera de
# Documents) y el servicio corre desde ahí.
#
#   Re-ejecútalo tras cambiar personajes.json / quests.json para refrescar la copia.
#   Parar/quitar:  ./parar-servicio.sh
#
# EJECÚTALO TÚ: expone tu Ollama a internet por un túnel protegido con token.
# ============================================================================
set -e
SRC="$HOME/Documents/juego-ia/app"
DST="$HOME/.anima-srv"                       # fuera de ~/Documents (sin bloqueo TCC)
LA="$HOME/Library/LaunchAgents"
PAGES="https://ruben-arconada.github.io/anima-pueblo-ia"
UID_N=$(id -u)
mkdir -p "$DST/server" "$DST/data" "$LA"

# 1) copia código + datos a una ubicación accesible por launchd
cp "$SRC/server/anima_server.py" "$DST/server/"
cp "$SRC/server/requirements.txt" "$DST/server/"
cp "$SRC/data/personajes.json" "$DST/data/"
cp "$SRC/data/quests.json" "$DST/data/" 2>/dev/null || true

# 2) venv propio EN $DST (no en Documents)
[ -d "$DST/server/.venv" ] || python3 -m venv "$DST/server/.venv"
"$DST/server/.venv/bin/pip" install -q -r "$DST/server/requirements.txt"

TOKEN=$(cat "$DST/.token" 2>/dev/null || cat /tmp/anima-token.txt 2>/dev/null || openssl rand -hex 12)
echo "$TOKEN" > "$DST/.token"
CF=$(command -v cloudflared || echo /opt/homebrew/bin/cloudflared)

# 3) plists -> apuntan a $DST
cat > "$LA/com.anima.backend.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.anima.backend</string>
  <key>ProgramArguments</key><array>
    <string>$DST/server/.venv/bin/uvicorn</string>
    <string>anima_server:app</string>
    <string>--host</string><string>0.0.0.0</string><string>--port</string><string>8011</string>
  </array>
  <key>WorkingDirectory</key><string>$DST/server</string>
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

# 4) (re)carga los servicios
launchctl bootout "gui/$UID_N/com.anima.backend" 2>/dev/null || true
launchctl bootout "gui/$UID_N/com.anima.tunnel" 2>/dev/null || true
pkill -f "uvicorn anima_server" 2>/dev/null || true   # libera el 8011 si había un proceso de sesión
: > /tmp/anima-tunnel.log
launchctl bootstrap "gui/$UID_N" "$LA/com.anima.backend.plist"
launchctl bootstrap "gui/$UID_N" "$LA/com.anima.tunnel.plist"

echo "Servicios cargados. Esperando la URL del túnel..."
URL=""
for i in $(seq 1 25); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/anima-tunnel.log 2>/dev/null | tail -1)
  [ -n "$URL" ] && break
  sleep 2
done

echo "────────────────────────────────────────────"
echo "  Backend instalado en: $DST  (fuera de Documents, accesible por launchd)"
echo "  Token:  $TOKEN"
echo "  Túnel:  ${URL:-(revisa /tmp/anima-tunnel.log)}"
echo "  Jugar con tu 7B:"
echo "  $PAGES/?ia=$URL&k=$TOKEN"
echo "────────────────────────────────────────────"

# ── URL ESTABLE (no cambia nunca) — túnel con NOMBRE (cuando quieras) ───────
#   cloudflared login
#   cloudflared tunnel create anima
#   cloudflared tunnel route dns anima anima.TUDOMINIO.com
#   y apunta el plist com.anima.tunnel a:  tunnel run anima
