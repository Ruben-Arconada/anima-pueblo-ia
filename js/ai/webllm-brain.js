// CEREBRO: IA real ejecutándose DENTRO del navegador (WebGPU + WebLLM).
// Coste de servidor 0 €, funciona aunque el Mac esté apagado, instancia por jugador.
// El modelo se descarga la primera vez y queda cacheado (IndexedDB).

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// Selección por dispositivo (probada en Ollama: 3B >> 1.5B >> 0.5B en español/roleplay).
// Escritorio: calidad (3B). Móvil: equilibrio (1.5B) o ligero (1B) según memoria.
function entorno() {
  const coarse = matchMedia("(pointer:coarse)").matches;
  const esMovil = navigator.userAgentData?.mobile ?? coarse;
  const ram = navigator.deviceMemory || 8;
  return { esMovil, ram };
}

function elegirPreferidos() {
  const { esMovil, ram } = entorno();
  if (!esMovil)
    return [
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    ];
  if (ram <= 4)
    return ["Llama-3.2-1B-Instruct-q4f16_1-MLC", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"];
  return [
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  ];
}

export class WebLLMBrain {
  kind = "webllm";
  label = "IA en tu navegador (WebLLM)";

  async init(onStatus) {
    if (!("gpu" in navigator)) throw new Error("sin WebGPU");
    const { esMovil, ram } = entorno();
    // GATES de seguridad ANTES de descargar: si no, la pestaña puede morir a mitad.
    if (ram < 4) throw new Error("memoria del dispositivo justa para IA local");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("sin adaptador WebGPU");
    if (esMovil && !adapter.features.has("shader-f16"))
      throw new Error("GPU móvil sin soporte f16"); // evita que WebLLM caiga a q4f32 (~2x VRAM)

    const ids = webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
    const prefs = elegirPreferidos();
    this.model =
      prefs.find((p) => ids.includes(p)) || ids.find((id) => /1\.5B|0\.5B|1B/i.test(id));
    if (!this.model) throw new Error("sin modelo pequeño disponible");

    this.engine = await webllm.CreateMLCEngine(this.model, {
      initProgressCallback: (r) => onStatus && onStatus(r.text, r.progress ?? 0),
    });
    this.label = `IA en tu navegador · ${this.model.replace(/-MLC$/, "")}`;
  }

  // Construye el system prompt en caliente: persona + relación (memoria) + contexto de quest.
  _system(npc, { meta, deseo, expectativa } = {}) {
    let s = npc.systemPrompt;
    if (meta) {
      if (!meta.veces || meta.veces <= 1) s += "\n[RELACIÓN] Es la primera vez que habláis.";
      else
        s += `\n[RELACIÓN] Ya os conocéis: habéis hablado ${meta.veces} veces${
          meta.confianza > 0 ? " y hay confianza" : ""
        }. Trátale como a un conocido.`;
    }
    if (deseo)
      s += `\n[CONTEXTO OCULTO, no lo recites literal] Tienes un deseo sin resolver: ${deseo} Si surge, sácalo con naturalidad en tu propia voz.`;
    if (expectativa) s += `\n[CONTEXTO OCULTO, no lo recites literal] ${expectativa}`;
    return s;
  }

  async generate(npc, history, userText, opts = {}) {
    const { onToken, signal } = opts;
    const messages = [
      { role: "system", content: this._system(npc, opts) },
      ...history.slice(-8),
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
      temperature: 0.6,
      frequency_penalty: 0.3,
      presence_penalty: 0.3,
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
