// Orquestador del borrador jugable de Ánima (Fase 0).
// Une: pueblo 3D + capa de IA intercambiable + memoria por jugador + métricas.

import { cargarPersonajes } from "./npcs.js";
import { Village } from "./village.js";
import { ChatUI } from "./ui.js";
import { createBrain } from "./ai/brain.js";
import { loadHistory, saveHistory, loadMeta, marcarEncuentro, borrarTodo, playerId } from "./memory.js";
import { formatMetrics, record, summary } from "./metrics.js";

const $ = (id) => document.getElementById(id);

let brain = null;
let brainReady = false;
let sesion = null; // { npc, convo }

async function main() {
  const personajes = await cargarPersonajes();
  const ui = new ChatUI();

  const village = new Village($("escena"), personajes, {
    onProximity: (npc) => {
      const hint = $("hint");
      const hablar = $("hablar");
      if (npc) {
        hint.innerHTML = `Pulsa <b>E</b> o haz clic para hablar con <b style="color:${npc.color}">${npc.nombre}</b>`;
        hint.classList.add("visible");
        hablar.textContent = `💬 Hablar con ${npc.nombre}`;
        hablar.classList.add("visible");
        hablar.onclick = () => abrirChat(ui, village, npc);
      } else {
        hint.classList.remove("visible");
        hablar.classList.remove("visible");
        hablar.onclick = null;
      }
    },
    onInteract: (npc) => abrirChat(ui, village, npc),
  });

  ui.onClose = () => village.setLocked(false);

  $("reset").addEventListener("click", () => {
    if (confirm("¿Borrar tu pueblo y empezar de cero? Los vecinos olvidarán todo lo hablado contigo.")) {
      borrarTodo();
      location.reload();
    }
  });

  // Pantalla de entrada: el clic arranca la descarga del modelo (mejor UX).
  $("entrar").addEventListener("click", async () => {
    $("intro").classList.add("oculto");
    await iniciarCerebro();
  });

  $("jugador-id").textContent = playerId().slice(0, 8);
  actualizarResumen();

  // Hook de depuración (inofensivo): permite probar el chat desde consola.
  window.__anima = {
    village,
    personajes,
    abrir: (id) => abrirChat(ui, village, personajes.find((p) => p.id === id)),
  };
}

async function iniciarCerebro() {
  const badge = $("ia-badge");
  badge.classList.add("visible");
  brain = await createBrain({
    onStatus: (txt, prog) => {
      const pct = prog ? ` ${Math.round(prog * 100)}%` : "";
      badge.innerHTML = `🧠 ${txt || "Despertando a los vecinos…"}${pct}`;
    },
  });
  brainReady = true;
  badge.innerHTML = `🧠 ${brain.label}`;
  if (brain.kind === "scripted") {
    badge.innerHTML += ` <span class="aviso">— abre en Chrome/Edge para la IA completa</span>`;
  }
}

function abrirChat(ui, village, npc) {
  village.setLocked(true);
  const historial = loadHistory(npc.id);
  const meta = loadMeta(npc.id);
  ui.open(npc, { memoria: meta });

  // Reproduce lo ya hablado para que la conversación continúe de verdad.
  historial.forEach((m) => {
    if (m.role === "user") ui.addUser(m.content);
    else {
      const s = ui.addNPCStream(npc.color);
      s.token(m.content);
      s.done("");
    }
  });

  if (historial.length === 0) {
    const s = ui.addNPCStream(npc.color);
    s.token(npc.saludo);
    s.done("saludo");
  }

  marcarEncuentro(npc.id);
  sesion = { npc, convo: historial.slice() };

  ui.onSend = (texto) => responder(ui, npc, texto);
}

async function responder(ui, npc, texto) {
  if (!brainReady) {
    ui.system("Los vecinos aún están despertando (cargando IA)…");
    return;
  }
  ui.addUser(texto);
  const stream = ui.addNPCStream(npc.color);
  try {
    const res = await brain.generate(npc, sesion.convo, texto, {
      onToken: (t) => stream.token(t),
    });
    stream.done(formatMetrics(res.metrics));
    sesion.convo.push({ role: "user", content: texto });
    sesion.convo.push({ role: "assistant", content: res.text });
    saveHistory(npc.id, sesion.convo);
    record(res.metrics);
    actualizarResumen();
  } catch (e) {
    console.error(e);
    stream.token("(se me ha ido el santo al cielo… inténtalo otra vez)");
    stream.done("error");
  }
}

function actualizarResumen() {
  $("resumen").textContent = summary();
}

main().catch((e) => {
  console.error(e);
  document.getElementById("intro").innerHTML =
    `<div class="caja"><h1>Ups</h1><p>No se pudo cargar el pueblo.</p><pre>${e.message}</pre></div>`;
});
