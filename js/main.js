// Orquestador de Ánima: pueblo 3D + IA intercambiable + memoria por jugador +
// quests sociales + métricas.

import { cargarPersonajes } from "./npcs.js";
import { Village } from "./village.js";
import { ChatUI } from "./ui.js";
import { createBrain } from "./ai/brain.js";
import { loadHistory, saveHistory, loadMeta, marcarEncuentro, subirConfianza, borrarTodo, playerId } from "./memory.js";
import { formatMetrics, record, summary } from "./metrics.js";
import { cargarQuests, ofertaDe, deseoDe, expectativaDe, evaluarDecir, activas, hechas, total, todasHechas, estadoPuebloDe } from "./quests.js";

const $ = (id) => document.getElementById(id);

let brain = null;
let brainReady = false;
let sesion = null; // { npc, convo, meta, deseo, expectativa }
let _personajes = [];

const colorDe = (id) => (_personajes.find((p) => p.id === id) || {}).color || "#888";

async function main() {
  const [personajes] = await Promise.all([cargarPersonajes(), cargarQuests()]);
  _personajes = personajes;
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

  ui.onClose = () => {
    village.setLocked(false);
    village.renderer.domElement.focus(); // re-enfoca el canvas: WASD vuelve a responder sin clicar
  };

  $("diario-btn")?.addEventListener("click", () => {
    refrescarDiario(ui);
    ui.toggleDiario();
  });

  $("reset").addEventListener("click", () => {
    if (confirm("¿Borrar tu pueblo y empezar de cero? Los vecinos olvidarán todo lo hablado y las quests.")) {
      borrarTodo();
      location.reload();
    }
  });

  $("entrar").addEventListener("click", async () => {
    $("intro").classList.add("oculto");
    await iniciarCerebro();
  });

  $("jugador-id").textContent = playerId().slice(0, 8);
  actualizarResumen();
  refrescarDiario(ui);
  setupViewportHook();

  window.__anima = {
    village,
    personajes,
    abrir: (id) => abrirChat(ui, village, personajes.find((p) => p.id === id)),
  };
}

async function iniciarCerebro() {
  const badge = $("ia-badge");
  badge.classList.add("visible");
  const c = navigator.connection;
  if (c && (c.saveData || /(^|\b)(2g|slow-2g)\b/.test(c.effectiveType || ""))) {
    if (!confirm("La IA descarga un modelo (~1-2 GB) la primera vez (luego va cacheada). ¿Continuar? Cancelar = modo sin IA.")) {
      const { ScriptedBrain } = await import("./ai/scripted-brain.js");
      brain = new ScriptedBrain();
      await brain.init();
      brainReady = true;
      badge.innerHTML = `🧠 ${brain.label}`;
      return;
    }
  }
  brain = await createBrain({
    onStatus: (txt, prog) => {
      const pct = prog != null ? ` ${Math.round(prog * 100)}%` : "";
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

  historial.forEach((m) => {
    if (m.role === "user") ui.addUser(m.content);
    else {
      const s = ui.addNPCStream(npc.color);
      s.replace(m.content);
      s.done("");
    }
  });

  if (historial.length === 0) {
    const dioQuestHecha = hechas().some((q) => q.giver === npc.id);
    const s = ui.addNPCStream(npc.color);
    s.replace(dioQuestHecha && npc.saludoTrasQuest ? npc.saludoTrasQuest : npc.saludo);
    s.done(meta.veces > 0 ? "" : "saludo");
  }

  marcarEncuentro(npc.id);

  const oferta = ofertaDe(npc.id);
  if (oferta) {
    ui.questToast(oferta.ofrece, npc.color);
    refrescarDiario(ui);
  }

  const exp = [expectativaDe(npc.id), estadoPuebloDe()].filter(Boolean).join(" ") || null;
  sesion = { npc, convo: historial.slice(), meta, deseo: deseoDe(npc.id), expectativa: exp, confSubida: false };
  ui.onSend = (texto) => responder(ui, npc, texto);
}

async function responder(ui, npc, texto) {
  if (!brainReady) {
    ui.system("Los vecinos aún están despertando (cargando IA)…");
    return;
  }
  ui.addUser(texto);

  // ¿el texto del jugador cierra una quest cuyo objetivo es este NPC?
  const cerrada = evaluarDecir(npc.id, texto);
  if (cerrada) {
    subirConfianza(cerrada.giver);
    ui.questToast(cerrada.cierre, colorDe(cerrada.giver));
    sesion.deseo = deseoDe(npc.id);
    sesion.expectativa = [expectativaDe(npc.id), estadoPuebloDe()].filter(Boolean).join(" ") || null;
    refrescarDiario(ui);
    if (todasHechas()) setTimeout(() => ui.system("✨ Has despertado a Ánima. El pueblo entero respira distinto gracias a ti; la feria por fin tiene fecha."), 700);
  }

  const stream = ui.addNPCStream(npc.color);
  try {
    const res = await brain.generate(npc, sesion.convo, texto, {
      onToken: (t) => stream.token(t),
      meta: sesion.meta,
      // El "deseo" solo se insinúa en el PRIMER mensaje, para que no lo repita cada turno.
      deseo: sesion.convo.length === 0 ? sesion.deseo : null,
      expectativa: sesion.convo.length < 4 ? sesion.expectativa : null,
    });
    stream.done(formatMetrics(res.metrics));
    sesion.convo.push({ role: "user", content: texto });
    sesion.convo.push({ role: "assistant", content: res.text });
    saveHistory(npc.id, sesion.convo);
    record(res.metrics);
    actualizarResumen();
    // micro-recompensa: cada conversación con respuesta sube un poco el afecto (una vez por sesión)
    if (!sesion.confSubida) {
      subirConfianza(npc.id);
      sesion.confSubida = true;
    }
  } catch (e) {
    console.error(e);
    // Degradar a modo sin IA EN CALIENTE (p.ej. OOM en runtime) en vez de un error opaco.
    if (brain.kind !== "scripted") {
      try {
        const { ScriptedBrain } = await import("./ai/scripted-brain.js");
        brain = new ScriptedBrain();
        await brain.init();
        brainReady = true;
        $("ia-badge").innerHTML = `🧠 ${brain.label}`;
      } catch {}
    }
    stream.replace("(se me fue el santo al cielo… vuelve a intentarlo)");
    stream.done("modo sin IA");
  }
}

function refrescarDiario(ui) {
  ui.renderDiario(
    activas().map((q) => ({ ...q, color: colorDe(q.giver) })),
    hechas(),
    { hechas: hechas().length, total: total() }
  );
  const prog = $("progreso");
  if (prog) prog.textContent = `Ánima: ${hechas().length}/${total()} hilos`;
}

function actualizarResumen() {
  $("resumen").textContent = summary();
}

// El teclado virtual del móvil no debe tapar el input: subimos el panel.
function setupViewportHook() {
  const vv = window.visualViewport;
  if (!vv) return;
  const chat = $("chat");
  const f = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    chat.style.setProperty("--kb", kb + "px");
  };
  vv.addEventListener("resize", f);
  vv.addEventListener("scroll", f);
  f();
}

main().catch((e) => {
  console.error(e);
  document.getElementById("intro").innerHTML =
    `<div class="caja"><h1>Ups</h1><p>No se pudo cargar el pueblo.</p><pre>${e.message}</pre></div>`;
});
