// Memoria persistente POR JUGADOR y POR PERSONAJE.
// "Instancia por jugador": cada navegador guarda su propio mundo en localStorage.
// Clave de memoria = (jugador, npc). Es justo el modelo que decidimos para escalar.

const PLAYER_KEY = "anima:playerId";
const MAX_TURNOS = 12; // historial corto: barato y suficiente para un NPC

export function playerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

const histKey = (npcId) => `anima:hist:${playerId()}:${npcId}`;
const metaKey = (npcId) => `anima:meta:${playerId()}:${npcId}`;

// Historial de mensajes [{role:'user'|'assistant', content}]
export function loadHistory(npcId) {
  try {
    return JSON.parse(localStorage.getItem(histKey(npcId))) || [];
  } catch {
    return [];
  }
}

export function saveHistory(npcId, history) {
  localStorage.setItem(histKey(npcId), JSON.stringify(history.slice(-MAX_TURNOS)));
}

// Metadatos: cuántas veces te ha visto, cuándo fue la última.
export function loadMeta(npcId) {
  try {
    return JSON.parse(localStorage.getItem(metaKey(npcId))) || { veces: 0, ultima: null };
  } catch {
    return { veces: 0, ultima: null };
  }
}

export function marcarEncuentro(npcId) {
  const m = loadMeta(npcId);
  m.veces += 1;
  m.ultima = Date.now();
  localStorage.setItem(metaKey(npcId), JSON.stringify(m));
  return m;
}

// Borra TODO el mundo de este jugador (botón de "empezar de cero" + RGPD-friendly).
export function borrarTodo() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("anima:"))
    .forEach((k) => localStorage.removeItem(k));
}
