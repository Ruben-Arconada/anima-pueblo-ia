// CAPA DE IA INTERCAMBIABLE.
// Una sola interfaz -> varias implementaciones. Hoy: WebLLM (en el navegador).
// Mañana, al crecer: un backend con Ollama o Claude API (ver server-brain.js).
// Cambiar de cerebro = cambiar una línea, sin tocar el juego.
//
// Interfaz que cumple todo "brain":
//   brain.kind   -> 'webllm' | 'scripted' | 'server'
//   brain.label  -> texto para mostrar al usuario
//   brain.generate(npc, history, userText, { onToken, signal }) ->
//        Promise<{ text, metrics:{ ttft, total, tokens, tps } }>

export async function createBrain({ onStatus } = {}) {
  // 1) Intentamos IA real en el navegador (WebGPU + WebLLM).
  try {
    if (!("gpu" in navigator)) throw new Error("Este navegador no tiene WebGPU");
    const { WebLLMBrain } = await import("./webllm-brain.js");
    const brain = new WebLLMBrain();
    await brain.init(onStatus);
    return brain;
  } catch (e) {
    console.warn("[brain] WebLLM no disponible, uso modo guion:", e && e.message);
  }
  // 2) Fallback: el pueblo sigue jugable con respuestas con personalidad (sin IA).
  const { ScriptedBrain } = await import("./scripted-brain.js");
  const brain = new ScriptedBrain();
  await brain.init(onStatus);
  return brain;
}
