// CAPA DE IA INTERCAMBIABLE — una interfaz, varias implementaciones.
// Prioridad: 1) SERVIDOR (tu Ollama 7B) si está configurado y vivo,
//            2) WebLLM (IA en el navegador), 3) modo sin IA (con personalidad).
// Cambiar de cerebro = no tocar el juego.
//
//   brain.kind   -> 'server' | 'webllm' | 'scripted'
//   brain.label  -> texto para mostrar
//   brain.generate(npc, history, userText, { onToken, signal, meta, deseo, expectativa })
//        -> Promise<{ text, metrics:{ ttft, total, tokens, tps } }>

// Config del servidor: se activa visitando ...?ia=<url>&k=<token> (se guarda y se
// limpia de la URL para no dejar el token a la vista). ?ia=off lo desactiva.
function leerConfigServidor() {
  try {
    const u = new URL(location.href);
    const ia = u.searchParams.get("ia");
    if (ia === "off") {
      localStorage.removeItem("anima:server");
      u.searchParams.delete("ia");
      u.searchParams.delete("k");
      history.replaceState(null, "", u.toString());
      return null;
    }
    if (ia) {
      const cfg = { url: ia, token: u.searchParams.get("k") || "" };
      localStorage.setItem("anima:server", JSON.stringify(cfg));
      u.searchParams.delete("ia");
      u.searchParams.delete("k");
      history.replaceState(null, "", u.toString());
      return cfg;
    }
    return JSON.parse(localStorage.getItem("anima:server") || "null");
  } catch {
    return null;
  }
}

export async function createBrain({ onStatus } = {}) {
  // 0) Servidor (tu Ollama 7B) si está configurado y responde.
  const cfg = leerConfigServidor();
  if (cfg && cfg.url) {
    try {
      onStatus && onStatus("Conectando con el servidor…", null);
      const { ServerBrain } = await import("./server-brain.js");
      const b = new ServerBrain(cfg.url, cfg.token);
      await b.init();
      return b;
    } catch (e) {
      console.warn("[brain] servidor no disponible, uso el navegador:", e && e.message);
    }
  }

  // 1) IA real en el navegador (WebGPU + WebLLM).
  try {
    if (!("gpu" in navigator)) throw new Error("Este navegador no tiene WebGPU");
    const { WebLLMBrain } = await import("./webllm-brain.js");
    const brain = new WebLLMBrain();
    await brain.init(onStatus);
    return brain;
  } catch (e) {
    console.warn("[brain] WebLLM no disponible, uso modo sin IA:", e && e.message);
  }

  // 2) Fallback con personalidad (sin IA): el pueblo sigue jugable.
  const { ScriptedBrain } = await import("./scripted-brain.js");
  const brain = new ScriptedBrain();
  await brain.init(onStatus);
  return brain;
}
