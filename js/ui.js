// Interfaz de chat (panel lateral). Renderiza la conversación y el streaming.

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
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) this.close();
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
    if (memoria && memoria.veces > 0) {
      this.mem.textContent = `💭 ${npc.nombre} te recuerda · habéis hablado ${memoria.veces} ${memoria.veces === 1 ? "vez" : "veces"}`;
      this.mem.style.display = "block";
    } else {
      this.mem.textContent = "✨ Primera vez que os veis";
      this.mem.style.display = "block";
    }
    this.panel.classList.add("abierto");
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.panel.classList.remove("abierto");
    this.onClose();
  }

  addUser(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.textContent = text;
    this.log.appendChild(el);
    this._scroll();
  }

  // Devuelve un controlador para ir añadiendo tokens al vuelo.
  addNPCStream(color) {
    const el = document.createElement("div");
    el.className = "msg npc";
    el.style.borderColor = color;
    const cuerpo = document.createElement("span");
    const meta = document.createElement("div");
    meta.className = "meta";
    el.appendChild(cuerpo);
    el.appendChild(meta);
    this.log.appendChild(el);
    this._scroll();
    return {
      token: (t) => {
        cuerpo.textContent += t;
        this._scroll();
      },
      done: (metaTxt) => {
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

  _scroll() {
    this.log.scrollTop = this.log.scrollHeight;
  }
}
