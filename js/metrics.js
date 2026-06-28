// Observabilidad desde la Fase 0: latencia y tokens/s por interacción.
// Es la métrica que los documentos de diseño piden vigilar desde el día 1.

export function formatMetrics(m) {
  if (!m) return "";
  const ttft = (m.ttft / 1000).toFixed(2);
  const total = (m.total / 1000).toFixed(2);
  const tps = m.tps ? m.tps.toFixed(0) : "—";
  return `⏱ ${total}s · primer token ${ttft}s · ${m.tps ? tps + " tok/s" : "instantáneo"} · ${m.tokens} tok`;
}

// Acumulado de la sesión para una conclusión rápida.
const acc = { n: 0, totalMs: 0, totalTok: 0 };

export function record(m) {
  if (!m) return;
  acc.n += 1;
  acc.totalMs += m.total || 0;
  acc.totalTok += m.tokens || 0;
}

export function summary() {
  if (!acc.n) return "Aún no has hablado con nadie.";
  const avg = (acc.totalMs / acc.n / 1000).toFixed(2);
  return `${acc.n} interacciones · ${avg}s de media · ${acc.totalTok} tokens · coste de servidor: 0 € (todo en tu navegador)`;
}
