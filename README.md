# Ánima — el pueblo de IA · borrador jugable

Un pueblo en 3D cuyos vecinos están movidos por **IA**: **improvisan** (no tienen guion),
**te recuerdan** entre visitas, reaccionan a lo que dices y te **proponen pequeñas quests**.

👉 **Jugar:** https://ruben-arconada.github.io/anima-pueblo-ia/

## 🎮 Cómo se juega
- Muévete con **WASD/flechas**, **joystick** (móvil) o **clic en el suelo** (point-and-click).
- Acércate a un vecino y pulsa **E**, haz **clic en él** o el botón **Hablar**.
- **J** o 📖 abre el **diario** de misiones. **🔊** silencia. **↺** reinicia tu pueblo.
- La IA: por defecto corre **en tu navegador** (WebGPU/WebLLM); mejor en Chrome/Edge. Sin
  WebGPU, "modo sin IA" con personalidad. Con servidor configurado, usa tu Ollama (ver abajo).

## ✨ Qué hay ahora
- **4 vecinos** (Bruno, Elena, Tomás, Marta) con persona, **memoria por jugador** y **afecto** (♥).
- **7 quests sociales** encadenadas (amistad y romance del pueblo) + objetivo *"Ánima: N/7 hilos"* + epílogo.
- **Pueblo 3D**: casas, árboles, farolas, **ciclo día/noche** (cielo, sol, niebla, estrellas, ventanas/farolas que se encienden), **sombras suaves**, y **transparencia por oclusión** (lo que tapa al jugador se ve translúcido, estilo BG3).
- **Jugador**: maniquí placeholder rigueado (idle + walk), a la altura de los vecinos. Se sustituye dejando un `.glb` (ver abajo).
- **Sonido**: grillos de noche + melodía posicional en la cantina (placeholder sintetizado; sustituible).

## 🧩 Arquitectura
| Pieza | Dónde |
|---|---|
| Capa de IA intercambiable (servidor → navegador → sin IA) | `js/ai/brain.js`, `webllm-brain.js`, `server-brain.js`, `scripted-brain.js` |
| Personajes y quests como **datos** | `data/personajes.json`, `data/quests.json` |
| Memoria por (jugador, npc) en `localStorage` | `js/memory.js` |
| Pueblo 3D, día/noche, oclusión, controles, modelo | `js/village.js` |
| Quests (motor), interfaz, métricas | `js/quests.js`, `js/ui.js`, `js/metrics.js` |
| Backend IA (FastAPI → Ollama) | `server/` |

## 🧍 Cambiar el modelo del jugador
Deja un `.glb` (rig humanoide + clips `idle`/`walk`) en **`app/models/jugador.glb`**. El juego
lo carga solo, lo **auto-escala a la altura de los vecinos** y reproduce idle/walk. Specs en
[`models/LEEME.md`](models/LEEME.md). Si llega en **T-pose sin rig**, se rigea en Blender
(ver `CLAUDE.md` en la raíz del proyecto, fuera del repo).

## 🔊 Sonido propio
Deja `audio/grillos.mp3` y `audio/cantina.mp3` (specs en [`audio/LEEME.md`](audio/LEEME.md)) y
sustituyen al placeholder.

## 🖥️ Backend de IA (opcional, tu Ollama 7B)
```bash
cd server && ./run.sh                       # backend local (imprime token)
cloudflared tunnel --url http://localhost:8011   # URL pública
# Persistente (servicio que sobrevive a reinicios): ./instalar-servicio.sh
```
Activa el servidor en el juego abriendo `...github.io/anima-pueblo-ia/?ia=<URL_túnel>&k=<TOKEN>`
(se guarda y se limpia de la barra). `?ia=off` vuelve al navegador.

## 💻 En local
```bash
cd app && python3 -m http.server 8000   # http://localhost:8000
```
