# Ánima — el pueblo de IA · borrador jugable (Fase 0)

Un pequeño pueblo en 3D cuyos vecinos están movidos por **IA**: **improvisan** sus
respuestas (no tienen guion), **te recuerdan** entre visitas y reaccionan a lo que dices.

Es el **primer borrador** del proyecto. Corre **100 % en el navegador**, sin servidor:
ideal para una URL pública jugable y de coste cero.

## 🎮 Jugar

👉 **URL en vivo:** se rellena al publicar en GitHub Pages.

- Muévete con **WASD** / flechas.
- Acércate a un vecino y pulsa **E** (o haz clic) para hablar.
- La primera vez se **descarga el modelo de IA** al navegador (cacheado después).
- Mejor en **Chrome / Edge** (WebGPU). Sin WebGPU, se juega en “modo sin IA”.

### En local
```bash
cd app
python3 -m http.server 8000   # o cualquier servidor estático
# abre http://localhost:8000
```

## 🧩 Cómo está hecho (y por qué así)

| Pieza | Decisión | Dónde |
|---|---|---|
| **Cerebro de los NPC** | IA real **en el navegador** (WebGPU + WebLLM). Coste de servidor 0 €. | `js/ai/webllm-brain.js` |
| **Capa de IA intercambiable** | Una interfaz; hoy WebLLM, mañana Ollama/Claude con cambiar una línea. | `js/ai/brain.js`, `js/ai/server-brain.js` |
| **Personajes como datos** | Añadir un vecino = añadir un objeto al JSON. Cero código. | `data/personajes.json` |
| **Memoria por jugador** | `(jugador, npc)` en `localStorage`. **Instancia por jugador**: tu pueblo es tuyo. | `js/memory.js` |
| **Métricas** | Latencia y tokens/s por interacción, desde el día 1. | `js/metrics.js` |
| **Pueblo 3D** | Three.js minimalista a propósito (la magia son los personajes). | `js/village.js` |

## 🌱 Preparado para crecer

Decidido: **instancia por jugador** ahora, arquitectura lista para escalar.
La capa de IA está desacoplada del juego, así que la ruta de crecimiento es **mover piezas, no reescribir**:

1. **Hoy (F0):** cerebro en el navegador (WebLLM), memoria local. Mundo de un jugador.
2. **Servidor:** swap a `ServerBrain` → el Mac con Ollama o Claude API. El juego no se entera.
3. **Directo (streaming):** la audiencia influye en los vecinos vía chat de Twitch.
4. **Salas pequeñas / mundo compartido:** varios jugadores en el mismo pueblo (cuando el loop esté validado).

## 📂 Estructura
```
index.html          entrada
styles.css
js/
  main.js           orquestador
  village.js        pueblo 3D (Three.js)
  ui.js             panel de chat
  npcs.js           carga de personajes
  memory.js         memoria por (jugador, npc)
  metrics.js        latencia / tokens
  ai/
    brain.js        capa de IA intercambiable (fábrica)
    webllm-brain.js IA en el navegador (en uso)
    scripted-brain.js  fallback con personalidad
    server-brain.js stub para Ollama/Claude (futuro)
data/personajes.json  los vecinos, como datos
```

---
Hecho como Fase 0 del proyecto Ánima. Local-first, coste controlado, premium para directos.
