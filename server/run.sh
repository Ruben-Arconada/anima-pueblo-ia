#!/usr/bin/env bash
# Backend de Ánima (FastAPI -> Ollama 7B). Reusa el patrón de "Asistente Adi".
set -e
cd "$(dirname "$0")"

# 1) Comprueba Ollama
if ! curl -s -m 3 http://localhost:11434/api/tags >/dev/null; then
  echo "⚠️  Ollama no responde en :11434. Arráncalo primero (ollama serve)."; exit 1
fi

# 2) venv propio (NO toca el de Adi)
if [ ! -d .venv ]; then python3 -m venv .venv; fi
source .venv/bin/activate
pip install -q -r requirements.txt

# 3) token (si no lo pasas, se genera uno)
: "${ANIMA_TOKEN:=$(openssl rand -hex 8)}"
export ANIMA_TOKEN
echo "──────────────────────────────────────────────"
echo "  Backend de Ánima en  http://localhost:8011"
echo "  Modelo: ${ANIMA_MODEL:-qwen2.5:7b}"
echo "  TOKEN:  $ANIMA_TOKEN"
echo "──────────────────────────────────────────────"
exec uvicorn anima_server:app --host 0.0.0.0 --port 8011
