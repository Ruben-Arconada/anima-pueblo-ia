// CEREBRO: IA real ejecutándose DENTRO del navegador (WebGPU + WebLLM).
// Coste de servidor 0 €, funciona aunque el Mac esté apagado, y encaja con
// "instancia por jugador": cada navegador piensa por su cuenta.
// El modelo se descarga la primera vez y queda cacheado (IndexedDB).

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// Preferimos modelos pequeños (rápidos y de descarga ligera). El primero
// que exista en la build de WebLLM, se usa. Qwen va en línea con el proyecto.
const PREFERIDOS = [
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f32_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
];

export class WebLLMBrain {
  kind = "webllm";
  label = "IA en tu navegador (WebLLM)";

  async init(onStatus) {
    if (!("gpu" in navigator)) throw new Error("sin WebGPU");
    const disponibles = webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
    this.model =
      PREFERIDOS.find((p) => disponibles.includes(p)) ||
      disponibles.find((id) => /0\.5B|1B/i.test(id));
    if (!this.model) throw new Error("sin modelo pequeño disponible");

    this.engine = await webllm.CreateMLCEngine(this.model, {
      initProgressCallback: (r) => onStatus && onStatus(r.text, r.progress ?? 0),
    });
    this.label = `IA en tu navegador · ${this.model.replace(/-MLC$/, "")}`;
  }

  async generate(npc, history, userText, { onToken, signal } = {}) {
    const messages = [
      { role: "system", content: npc.systemPrompt },
      ...history,
      { role: "user", content: userText },
    ];

    const t0 = performance.now();
    let ttft = null,
      text = "",
      chunks = 0,
      usage = null;

    const stream = await this.engine.chat.completions.create({
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.8,
      max_tokens: npc.maxTokens || 90,
    });

    for await (const chunk of stream) {
      if (signal && signal.aborted) break;
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (chunk.usage) usage = chunk.usage;
      if (delta) {
        if (ttft === null) ttft = performance.now() - t0;
        chunks += 1;
        text += delta;
        onToken && onToken(delta);
      }
    }

    const total = performance.now() - t0;
    const tokens = usage?.completion_tokens || chunks;
    return {
      text: text.trim(),
      metrics: { ttft: ttft ?? total, total, tokens, tps: tokens / (total / 1000) },
    };
  }
}
