// Interfaz: chat inferior translúcido + diario de quests + toasts diegéticos.

export class ChatUI {
  constructor() {
    this.panel = document.getElementById("chat");
    this.titulo = document.getElementById("chat-nombre");
    this.rol = document.getElementById("chat-rol");
    this.mem = document.getElementById("chat-memoria");
    this.log = document.getElementById("chat-log");
    this.form = document.getElementById("chat-form");
    this.input = document.getElementById("chat-input");
    this.cerrar = document.getElementById("chat-cerrar");
    this.diario = document.getElementById("diario");
    this.diarioLista = document.getElementById("diario-lista");
    this.onSend = () => {};
    this.onClose = () => {};

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const txt = this.input.value.trim();
      if (!txt) return;
      this.input.value = "";
      this.onSend(txt);
    });
    this.cerrar.addEventListener("click", () => this.close());
    document.getElementById("diario-cerrar")?.addEventListener("click", () => this.toggleDiario(false));
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.diario?.classList.contains("abierto")) this.toggleDiario(false);
        else if (this.isOpen()) this.close();
      }
      if (e.key.toLowerCase() === "j" && !this.isOpen() && document.activeElement !== this.input) {
        this.toggleDiario();
      }
    });
  }

  isOpen() {
    return this.panel.classList.contains("abierto");
  }

  open(npc, { memoria } = {}) {
    this.titulo.textContent = npc.nombre;
    this.titulo.style.color = npc.color;
    this.rol.textContent = npc.rol;
    this.log.innerHTML = "";
    const conf = Math.min((memoria && memoria.confianza) || 0, 5);
    const corazones = `<span class="afecto" style="color:${npc.color}">${"♥".repeat(conf)}${"♡".repeat(5 - conf)}</span>`;
    if (memoria && memoria.veces > 0) {
      this.mem.innerHTML = `💭 ${npc.nombre} te recuerda · habéis hablado ${memoria.veces} ${memoria.veces === 1 ? "vez" : "veces"} ${corazones}`;
    } else {
      this.mem.innerHTML = `✨ Primera vez que os veis ${corazones}`;
    }
    this.panel.classList.add("abierto");
    document.body.classList.add("chat-open");
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.panel.classList.remove("abierto");
    document.body.classList.remove("chat-open");
    this.onClose();
  }

  addUser(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.textContent = text;
    this.log.appendChild(el);
    this._scroll();
  }

  // Streaming con buffer por requestAnimationFrame (no compite con la inferencia).
  addNPCStream(color) {
    const el = document.createElement("div");
    el.className = "msg npc";
    el.style.borderColor = color;
    const cuerpo = document.createElement("span");
    const meta = document.createElement("div");
    meta.className = "meta";
    el.append(cuerpo, meta);
    this.log.appendChild(el);
    this._scroll();
    let full = "",
      raf = null;
    const flush = () => {
      raf = null;
      cuerpo.textContent = full;
      this._scroll();
    };
    return {
      token: (t) => {
        full += t;
        if (!raf) raf = requestAnimationFrame(flush);
      },
      replace: (txt) => {
        full = txt;
        cuerpo.textContent = txt;
        this._scroll();
      },
      done: (metaTxt) => {
        if (raf) cancelAnimationFrame(raf);
        cuerpo.textContent = full;
        meta.textContent = metaTxt || "";
        this._scroll();
      },
    };
  }

  system(text) {
    const el = document.createElement("div");
    el.className = "msg system";
    el.textContent = text;
    this.log.appendChild(el);
    this._scroll();
  }

  // Toast diegético efímero (oferta/cierre de quest), con el color del NPC.
  questToast(text, color) {
    const t = document.createElement("div");
    t.className = "quest-toast";
    t.textContent = text;
    if (color) t.style.borderColor = color;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 400);
    }, 3800);
  }

  toggleDiario(force) {
    if (!this.diario) return;
    const abrir = force === undefined ? !this.diario.classList.contains("abierto") : force;
    this.diario.classList.toggle("abierto", abrir);
  }

  renderDiario(activas, hechas, info = {}) {
    if (!this.diarioLista) return;
    this.diarioLista.innerHTML = "";
    if (info.total) {
      const h = document.createElement("div");
      h.className = "q-progreso";
      h.textContent = `Ánima despierta · ${info.hechas}/${info.total} hilos tejidos`;
      this.diarioLista.appendChild(h);
    }
    if (!activas.length && !hechas.length) {
      const p = document.createElement("p");
      p.className = "q-vacio";
      p.textContent = "Aún no tienes recados. Acércate a los vecinos: alguno necesitará tu ayuda.";
      this.diarioLista.appendChild(p);
      return;
    }
    for (const q of activas) {
      const d = document.createElement("div");
      d.className = "q-item";
      d.style.borderColor = q.color || "#888";
      d.textContent = "• " + q.diario;
      this.diarioLista.appendChild(d);
    }
    for (const q of hechas) {
      const d = document.createElement("div");
      d.className = "q-item hecha";
      d.textContent = "✓ " + q.diario;
      this.diarioLista.appendChild(d);
    }
  }

  _scroll() {
    this.log.scrollTop = this.log.scrollHeight;
  }
}
