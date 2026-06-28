"""Backend de Ánima: el navegador NUNCA habla directo con el modelo (regla del doc 03).
Pasa por aquí, que guarda las personas, arma el prompt, modera y llama a Ollama (7B).
Mismo contrato que el cerebro de navegador, así el juego no se entera de cuál usa.

Arranque:  ./run.sh   (o:  ANIMA_TOKEN=xxx uvicorn anima_server:app --port 8011)
"""
import json
import os
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

OLLAMA = "http://localhost:11434/api/chat"
MODEL = os.environ.get("ANIMA_MODEL", "qwen2.5:7b")
TOKEN = os.environ.get("ANIMA_TOKEN", "")          # si está vacío, no exige auth (modo dev)
RATE_MAX = int(os.environ.get("ANIMA_RATE", "30")) # peticiones por minuto y por IP

DATA = Path(__file__).resolve().parent.parent / "data" / "personajes.json"
PERSONAJES = {p["id"]: p for p in json.loads(DATA.read_text(encoding="utf-8"))["personajes"]}

app = FastAPI(title="Ánima server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # auth por token; no usamos cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

_hits = defaultdict(list)

def _rate_ok(ip: str) -> bool:
    now = time.monotonic()
    q = _hits[ip] = [t for t in _hits[ip] if now - t < 60]
    if len(q) >= RATE_MAX:
        return False
    q.append(now)
    return True

def _system(npc: dict, meta: dict, deseo: str, expectativa: str) -> str:
    s = npc["systemPrompt"]
    s += "\n[ESTILO] No repitas preguntas ni frases que ya hayas dicho en esta conversación; varía y haz que avance."
    if meta:
        if not meta.get("veces") or meta["veces"] <= 1:
            s += "\n[RELACIÓN] Es la primera vez que habláis."
        else:
            extra = " y hay confianza" if meta.get("confianza", 0) > 0 else ""
            s += f"\n[RELACIÓN] Ya os conocéis: habéis hablado {meta['veces']} veces{extra}. Trátale como a un conocido."
    if deseo:
        s += f"\n[CONTEXTO OCULTO, no lo recites literal] Tienes un deseo: {deseo} Menciónalo UNA sola vez con naturalidad si encaja; si ya lo dijiste o el jugador ya respondió, NO insistas."
    if expectativa:
        s += f"\n[CONTEXTO OCULTO, no lo recites literal] {expectativa}"
    return s

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "personajes": list(PERSONAJES)}

@app.post("/api/chat")
async def chat(req: Request, authorization: str = Header(default="")):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="token inválido")
    ip = req.client.host if req.client else "?"
    if not _rate_ok(ip):
        raise HTTPException(status_code=429, detail="demasiadas peticiones, espera un momento")

    body = await req.json()
    npc = PERSONAJES.get(body.get("npc"))
    if not npc:
        return JSONResponse({"error": "npc desconocido"}, status_code=400)

    history = body.get("history") or []
    messages = (
        [{"role": "system", "content": _system(npc, body.get("meta") or {}, body.get("deseo"), body.get("expectativa"))}]
        + history[-8:]
        + [{"role": "user", "content": body.get("message", "")}]
    )
    payload = json.dumps({
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.6,
            "repeat_penalty": 1.2,
            "num_predict": npc.get("maxTokens", 100),
        },
    }).encode()

    def gen():
        r = urllib.request.Request(OLLAMA, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=120) as resp:
            for line in resp:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                chunk = obj.get("message", {}).get("content", "")
                if chunk:
                    yield chunk

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")
