// IMPLEMENTACIÓN FUTURA (no se usa todavía): cerebro en SERVIDOR.
// Cuando el juego crezca, los NPCs dejarán de pensar en el navegador y pedirán
// la respuesta a un backend (el Mac con Ollama, o Claude API en la nube).
// Gracias a que la interfaz es la misma que WebLLMBrain, el juego NO se entera.
//
// Esto es exactamente el "principio rector": diseñar para escalar desde el día 1,
// pero construir lo mínimo en cada fase. Aquí queda el punto de enganche.

export class ServerBrain {
  kind = "server";
  label = "IA en servidor (Ollama / Claude)";

  // baseUrl: p.ej. "https://api.tu-juego.com"  o  un túnel al Mac con Ollama.
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async init() {
    /* aquí iría un health-check del backend */
  }

  async generate(npc, history, userText, { onToken, signal } = {}) {
    const t0 = performance.now();
    let ttft = null,
      text = "",
      tokens = 0;

    // El navegador NUNCA habla directo con el modelo: pasa por el backend,
    // que guarda personas, memoria, moderación y topes (regla de oro del doc 03).
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ npc: npc.id, history, message: userText }),
    });

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value);
      if (chunk) {
        if (ttft === null) ttft = performance.now() - t0;
        tokens += 1;
        text += chunk;
        onToken && onToken(chunk);
      }
    }
    const total = performance.now() - t0;
    return { text, metrics: { ttft: ttft ?? total, total, tokens, tps: tokens / (total / 1000) } };
  }
}
