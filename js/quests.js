// Motor de QUESTS data-driven (cadena social en anillo). Mínimo y determinista:
// el LLM improvisa el CÓMO se dice; este motor gobierna el QUÉ avanza.
// Estado por jugador en localStorage. Completado por regex sobre el texto del
// JUGADOR (no sobre la respuesta del LLM, que en modelos pequeños es impredecible).

import { loadQuests, saveQuests } from "./memory.js";

let _defs = null;

export async function cargarQuests() {
  if (_defs) return _defs;
  try {
    const r = await fetch("./data/quests.json", { cache: "no-cache" });
    _defs = (await r.json()).quests || [];
  } catch {
    _defs = [];
  }
  return _defs;
}

const def = (id) => _defs.find((q) => q.id === id);
export const estadoDe = (id) => loadQuests()[id] || "oculta";

function set(id, st) {
  const s = loadQuests();
  s[id] = st;
  saveQuests(s);
}

const disponible = (q) => !q.requiere || estadoDe(q.requiere) === "hecha";

// Al abrir un NPC: si es el que DA una quest oculta ya disponible, ofrécela.
export function ofertaDe(npcId) {
  const q = _defs.find((q) => q.giver === npcId && estadoDe(q.id) === "oculta" && disponible(q));
  if (q) {
    set(q.id, "activa");
    return q;
  }
  return null;
}

// Contexto oculto que se inyecta en el prompt del NPC dador (para que saque su deseo).
export function deseoDe(npcId) {
  const q = _defs.find((q) => q.giver === npcId && estadoDe(q.id) === "activa");
  return q ? q.deseo : null;
}

// Contexto oculto para el NPC objetivo (para que reaccione si le traes el recado).
export function expectativaDe(npcId) {
  const qs = _defs.filter((q) => q.target === npcId && estadoDe(q.id) === "activa");
  return qs.length ? qs.map((q) => q.hintTarget).filter(Boolean).join(" ") : null;
}

// Al hablar con un NPC: ¿el texto del jugador cierra una quest activa cuyo objetivo es él?
// quita tildes para que los triggers casen aunque el jugador escriba sin acentos
const sinTildes = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function evaluarDecir(npcId, userText) {
  const t = sinTildes(userText);
  const q = _defs.find(
    (q) => q.target === npcId && estadoDe(q.id) === "activa" && new RegExp(q.triggerDecir, "i").test(t)
  );
  if (q) {
    set(q.id, "hecha");
    return q;
  }
  return null;
}

export const activas = () => _defs.filter((q) => estadoDe(q.id) === "activa");
export const hechas = () => _defs.filter((q) => estadoDe(q.id) === "hecha");
export const total = () => _defs.length;
export const todasHechas = () => _defs.length > 0 && _defs.every((q) => estadoDe(q.id) === "hecha");

// Frase de "estado del pueblo" que se inyecta como contexto para que los NPCs comenten los cambios.
export function estadoPuebloDe() {
  const hecha = (id) => estadoDe(id) === "hecha";
  const f = [];
  if (hecha("q_elena_palabra")) f.push("Bruno y Elena han vuelto a saludarse.");
  if (hecha("q_tomas_secreto") || hecha("q_marta_carta")) f.push("corre el rumor de una vieja carta entre Bruno y Marta.");
  if (todasHechas()) f.push("el pueblo entero parece más despierto y unido.");
  return f.length ? "[ESTADO DEL PUEBLO, tenlo en cuenta] " + f.join(" ") : null;
}
