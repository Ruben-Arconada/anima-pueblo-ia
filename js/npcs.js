// PERSONAJES COMO DATOS (no hardcodeados). Se cargan de data/personajes.json.
// Añadir un NPC = añadir un objeto al JSON. Cero cambios de código.

let _cache = null;

export async function cargarPersonajes() {
  if (_cache) return _cache;
  const res = await fetch("./data/personajes.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("No se pudo cargar personajes.json");
  const data = await res.json();
  _cache = data.personajes.map((p) => ({
    ...p,
    // sistema de prompt + datos de render listos para usar
  }));
  return _cache;
}

export function porId(lista, id) {
  return lista.find((p) => p.id === id);
}
