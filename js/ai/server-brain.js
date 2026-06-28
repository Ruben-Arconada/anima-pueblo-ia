// CEREBRO en SERVIDOR: el navegador pide la respuesta a TU backend (FastAPI -> Ollama 7B).
// El navegador NUNCA habla directo con el modelo (regla del doc 03): persona, memoria,
// moderación y límites viven en el backend. Misma interfaz que el cerebro de navegador.

export class ServerBrain {
  kind = "server";
  label = "IA en servidor (Ollama)";

  constructor(baseUrl, token) {
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
    this.token = token || "";
  }

  async init() {
    const r = await fetch(this.baseUrl + "/health", { method: "GET" });
    if (!r.ok) throw new Error("backend no responde");
    const d = await r.json();
    this.label = `IA en servidor · ${d.model || "Ollama"}`;
  }

  async generate(npc, history, userText, opts = {}) {
    const { onToken, signal, meta, deseo, expectativa } = opts;
    const t0 = performance.now();
    let ttft = null,
      text = "",
      tokens = 0;

    const res = await fetch(this.baseUrl + "/api/chat", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ npc: npc.id, message: userText, history, meta, deseo, expectativa }),
    });
    if (!res.ok) throw new Error("servidor " + res.status);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      if (chunk) {
        if (ttft === null) ttft = performance.now() - t0;
        tokens += chunk.split(/\s+/).filter(Boolean).length;
        text += chunk;
        onToken && onToken(chunk);
      }
    }
    const total = performance.now() - t0;
    return { text: text.trim(), metrics: { ttft: ttft ?? total, total, tokens, tps: tokens / (total / 1000) } };
  }
}
