// EL PUEBLO en 3D (Three.js). Estilo minimalista a propósito: la magia son los
// personajes, no los gráficos (antiobjetivo del roadmap: nada de 3D AAA en F0).
// Te mueves con WASD / flechas; al acercarte a un NPC puedes hablar (E o clic).

import * as THREE from "three";

const RADIO_INTERACCION = 4.2;
const LIMITE = 22; // bordes del pueblo

function etiqueta(texto, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(20,20,28,0.85)";
  ctx.roundRect ? ctx.roundRect(4, 8, 248, 44, 12) : ctx.rect(4, 8, 248, 44);
  ctx.fill();
  ctx.fillStyle = color || "#fff";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(3.2, 0.8, 1);
  spr.position.y = 3.1;
  return spr;
}

export class Village {
  constructor(canvas, personajes, { onProximity, onInteract } = {}) {
    this.onProximity = onProximity || (() => {});
    this.onInteract = onInteract || (() => {});
    this.locked = false;
    this.cercano = null;
    this.keys = {};
    this.move = { x: 0, z: 0 }; // vector del joystick táctil

    // --- escena / cámara / render ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fc0d8);
    this.scene.fog = new THREE.Fog(0x9fc0d8, 30, 60);

    this.camera = new THREE.PerspectiveCamera(55, 2, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    // --- luces ---
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556b55, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 18, 6);
    this.scene.add(sun);

    // --- suelo + plaza ---
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(LIMITE + 4, 48),
      new THREE.MeshStandardMaterial({ color: 0x7fae6a })
    );
    suelo.rotation.x = -Math.PI / 2;
    this.scene.add(suelo);
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(7, 32),
      new THREE.MeshStandardMaterial({ color: 0xc8b89a })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    this.scene.add(plaza);

    // --- casas sencillas (una por zona) ---
    this._casa(-9, -8, 0x9b5a33, 6, 4); // cantina
    this._casa(9, -10, 0x4e7d52, 5, 3.5); // jardín / herboristería
    this._casa(-4, 12, 0x6f6f9a, 7, 5); // ayuntamiento

    // --- NPCs ---
    this.npcs = personajes.map((p) => this._npc(p));

    // --- jugador ---
    this.player = new THREE.Group();
    const cuerpo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e6fde })
    );
    cuerpo.position.y = 0.95;
    this.player.add(cuerpo);
    this.player.position.set(0, 0, -2);
    this.scene.add(this.player);

    // anillo de "puedes hablar"
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.raycaster = new THREE.Raycaster();
    this._bind(canvas);
    this._bindTouch();
    this.resize();
    this.clock = new THREE.Clock();
    this._loop();
  }

  _casa(x, z, color, w, h) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color })
    );
    m.position.set(x, h / 2, z);
    this.scene.add(m);
    const techo = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.85, 2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a3b2a })
    );
    techo.position.set(x, h + 1, z);
    techo.rotation.y = Math.PI / 4;
    this.scene.add(techo);
  }

  _npc(p) {
    const g = new THREE.Group();
    const col = new THREE.Color(p.color || "#cccccc");
    const cuerpo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({ color: col })
    );
    cuerpo.position.y = 0.95;
    const cabeza = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1d6b8 })
    );
    cabeza.position.y = 1.75;
    g.add(cuerpo, cabeza, etiqueta(p.nombre, "#fff"));
    g.position.set(p.pos[0], 0, p.pos[2]);
    g.userData.npc = p;
    g.userData.meshes = [cuerpo, cabeza];
    this.scene.add(g);
    return g;
  }

  _bind(canvas) {
    addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "e" && this.cercano && !this.locked) {
        this.onInteract(this.cercano.userData.npc);
      }
    });
    addEventListener("keyup", (e) => (this.keys[e.key.toLowerCase()] = false));
    addEventListener("resize", () => this.resize());
    canvas.addEventListener("pointerdown", (e) => {
      if (this.locked) return;
      const r = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
      this.raycaster.setFromCamera(mouse, this.camera);
      const hits = this.raycaster.intersectObjects(
        this.npcs.flatMap((n) => n.userData.meshes),
        false
      );
      if (hits.length) {
        const npcGroup = hits[0].object.parent;
        if (npcGroup.position.distanceTo(this.player.position) <= RADIO_INTERACCION) {
          this.onInteract(npcGroup.userData.npc);
        }
      }
    });
  }

  // Joystick virtual para móvil (no toca el teclado de escritorio).
  _bindTouch() {
    const esTactil = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!esTactil) return;
    document.body.classList.add("touch");
    const base = document.getElementById("joy-base");
    const knob = document.getElementById("joy-knob");
    if (!base || !knob) return;
    let id = null,
      cx = 0,
      cy = 0;
    const R = 46;
    const set = (t) => {
      let dx = t.clientX - cx,
        dy = t.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, R);
      dx = (dx / d) * cl;
      dy = (dy / d) * cl;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / R;
      this.move.z = dy / R; // arriba en pantalla = -z = adelante
    };
    const reset = () => {
      id = null;
      this.move.x = 0;
      this.move.z = 0;
      knob.style.transform = "translate(0,0)";
    };
    base.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      set(t);
    }, { passive: false });
    base.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) set(t);
    }, { passive: false });
    base.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) if (t.identifier === id) reset();
    });
    base.addEventListener("touchcancel", reset);
  }

  resize() {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLocked(v) {
    this.locked = v;
    Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // movimiento (teclado + joystick táctil)
    if (!this.locked) {
      const v = 6 * dt;
      let mx = 0,
        mz = 0;
      if (this.keys["a"] || this.keys["arrowleft"]) mx -= 1;
      if (this.keys["d"] || this.keys["arrowright"]) mx += 1;
      if (this.keys["w"] || this.keys["arrowup"]) mz -= 1;
      if (this.keys["s"] || this.keys["arrowdown"]) mz += 1;
      mx += this.move.x;
      mz += this.move.z;
      const mag = Math.hypot(mx, mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }
      this.player.position.x += mx * v;
      this.player.position.z += mz * v;
      this.player.position.x = Math.max(-LIMITE, Math.min(LIMITE, this.player.position.x));
      this.player.position.z = Math.max(-LIMITE, Math.min(LIMITE, this.player.position.z));
    }

    // cámara tercera persona
    const p = this.player.position;
    this.camera.position.lerp(new THREE.Vector3(p.x, 9, p.z + 12), 0.12);
    this.camera.lookAt(p.x, 1.2, p.z);

    // vida: los NPCs giran/flotan suavemente
    const t = this.clock.elapsedTime;
    this.npcs.forEach((n, i) => {
      n.rotation.y = Math.sin(t * 0.5 + i) * 0.4;
      n.position.y = Math.sin(t * 1.5 + i) * 0.04;
    });

    // proximidad: el NPC más cercano dentro del radio se "despierta"
    let cerca = null,
      dmin = RADIO_INTERACCION;
    for (const n of this.npcs) {
      const d = n.position.distanceTo(p);
      if (d < dmin) {
        dmin = d;
        cerca = n;
      }
    }
    if (cerca !== this.cercano) {
      this.cercano = cerca;
      this.onProximity(cerca ? cerca.userData.npc : null);
    }
    if (cerca) {
      this.ring.visible = true;
      this.ring.position.set(cerca.position.x, 0.02, cerca.position.z);
    } else {
      this.ring.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
