// EL PUEBLO en 3D (Three.js). Minimalista a propósito (la magia son los personajes),
// pero con un pase de pulido barato: tono filmico, sombras suaves en escritorio,
// cielo degradado, sombras de contacto y props. Gateado por móvil para que vaya fluido.
// Mueves con WASD / flechas (o joystick táctil); al acercarte hablas (E o clic).

import * as THREE from "three";

const RADIO_INTERACCION = 4.2;
const LIMITE = 22;
const ES_MOVIL = matchMedia("(pointer:coarse)").matches;

function cieloTextura() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#cfe6f2");
  g.addColorStop(1, "#dfe7d8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function etiqueta(texto, color) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = 256, H = 64;
  const c = document.createElement("canvas");
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "rgba(20,20,28,0.82)";
  ctx.beginPath();
  (ctx.roundRect ? ctx.roundRect(4, 8, W - 8, 44, 12) : ctx.rect(4, 8, W - 8, 44));
  ctx.fill();
  ctx.fillStyle = color || "#fff";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, W / 2, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
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
    this.move = { x: 0, z: 0 };
    this.moveTarget = null; // destino del point-and-click (ratón/táctil)
    this.pendingTalk = null; // NPC con quien hablar al llegar
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.occluders = []; // muros/tejados que se vuelven translúcidos si tapan al jugador (estilo BG3)
    this.occRay = new THREE.Raycaster();
    this.sombrasOn = !ES_MOVIL;

    // --- escena / cámara / render ---
    this.scene = new THREE.Scene();
    this.scene.background = cieloTextura();
    this.scene.fog = new THREE.Fog(0xc7dbd6, 34, 78);

    this.camera = new THREE.PerspectiveCamera(55, 2, 0.1, 84);
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !ES_MOVIL });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this._setDPR = () => this.renderer.setPixelRatio(Math.min(devicePixelRatio, ES_MOVIL ? 1.5 : 2));
    this._setDPR();
    this.renderer.shadowMap.enabled = this.sombrasOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- luces (refs guardadas para el ciclo día/noche) ---
    this._luces = []; // materiales emisivos (ventanas, farolas) que se encienden de noche
    this.hemi = new THREE.HemisphereLight(0xeaf2ff, 0x5a6b48, 0.85);
    this.scene.add(this.hemi);
    this.sol = new THREE.DirectionalLight(0xfff0d8, 1.55);
    this.sol.position.set(14, 20, 8);
    if (this.sombrasOn) {
      this.sol.castShadow = true;
      // 2048 + área más ajustada (s=20) => más resolución por texel => menos "tembleque"
      this.sol.shadow.mapSize.set(2048, 2048);
      const s = 20;
      Object.assign(this.sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
      this.sol.shadow.bias = -0.0004;
      this.sol.shadow.normalBias = 0.06;
    }
    this.scene.add(this.sol);
    const relleno = new THREE.DirectionalLight(0x9fc0ff, 0.35);
    relleno.position.set(-10, 8, -6);
    this.scene.add(relleno);

    // --- geometrías/materiales COMPARTIDOS (clave para draw calls en móvil) ---
    this.G = {
      capsula: new THREE.CapsuleGeometry(0.45, 0.9, 6, 12),
      cabeza: new THREE.SphereGeometry(0.32, 16, 16),
      disco: new THREE.CircleGeometry(0.5, 20),
    };
    this.M = {
      piel: new THREE.MeshStandardMaterial({ color: 0xf1d6b8, roughness: 1 }),
      sombra: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
      techo: new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 1, flatShading: true }),
    };

    // --- suelo + plaza ---
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(LIMITE + 4, 48),
      new THREE.MeshStandardMaterial({ color: 0x7fae6a, roughness: 1 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = this.sombrasOn;
    this.scene.add(suelo);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 1 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = this.sombrasOn;
    this.scene.add(plaza);
    const aro = new THREE.Mesh(new THREE.RingGeometry(7, 7.6, 40), new THREE.MeshStandardMaterial({ color: 0xa99877, roughness: 1, side: THREE.DoubleSide }));
    aro.rotation.x = -Math.PI / 2;
    aro.position.y = 0.012;
    this.scene.add(aro);

    // --- casas (una por zona) ---
    this._casa(-9, -8, 0x9b5a33, 6, 4);
    this._casa(9, -10, 0x4e7d52, 5, 3.5);
    this._casa(-4, 12, 0x6f6f9a, 7, 5);

    // --- props (árboles + farolas) en el anillo exterior ---
    this._props();

    // --- NPCs ---
    this.npcs = personajes.map((p) => this._npc(p));

    // --- jugador ---
    this.player = new THREE.Group();
    const cuerpo = new THREE.Mesh(this.G.capsula, new THREE.MeshStandardMaterial({ color: 0x2e6fde, roughness: 0.8 }));
    cuerpo.position.y = 0.95;
    cuerpo.castShadow = this.sombrasOn;
    this.player.add(cuerpo);
    this.playerCapsule = cuerpo; // se oculta si llega un modelo .glb
    this.player.position.set(0, 0, -2);
    this.scene.add(this.player);
    this._cargarModeloJugador(); // carga models/jugador.glb si existe (defensivo)
    this.playerShadow = new THREE.Mesh(this.G.disco, this.M.sombra);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.016;
    this.scene.add(this.playerShadow);

    // anillo de "puedes hablar"
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    // marca de destino del point-and-click
    this.clickMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.44, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.clickMarker.rotation.x = -Math.PI / 2;
    this.clickMarker.visible = false;
    this.scene.add(this.clickMarker);

    // estrellas en la bóveda (se encienden de noche, ignoran la niebla)
    const N = 220;
    const sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.85 + 0.15, Math.random() * 2 - 1).normalize().multiplyScalar(76);
      sp[i * 3] = d.x; sp[i * 3 + 1] = d.y; sp[i * 3 + 2] = d.z;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.estrellas = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.estrellas);

    this.raycaster = new THREE.Raycaster();
    this._bind(canvas);
    this._bindTouch();
    this.resize();

    // ciclo día/noche (1 día ≈ 8 min; persiste el momento en localStorage)
    this._diaT = Number(localStorage.getItem("anima:diaT")) || 0;
    this.CICLO = 360; // 1 día ≈ 6 min (más visible durante una sesión)
    this._setMomento(this._fase());

    this.clock = new THREE.Clock();
    this._loop();
  }

  // ---- Ciclo día/noche (reusa cielo, sol, niebla y materiales emisivos ya montados) ----
  _paletas() {
    return {
      amanecer: { top: "#f4c89a", bot: "#e9d6c0", sol: 0xffd9a0, solI: 0.9, hemi: 0.7, fog: "#e8d6c4", near: 30, far: 74, expo: 1.0, luces: 0.5 },
      dia: { top: "#cfe6f2", bot: "#dfe7d8", sol: 0xfff0d8, solI: 1.55, hemi: 0.85, fog: "#c7dbd6", near: 34, far: 78, expo: 1.05, luces: 0.0 },
      atardecer: { top: "#f0b07a", bot: "#caa0b0", sol: 0xffb072, solI: 1.1, hemi: 0.6, fog: "#d9b6a8", near: 28, far: 70, expo: 1.02, luces: 0.7 },
      noche: { top: "#16203f", bot: "#0c1224", sol: 0x6f86c8, solI: 0.32, hemi: 0.38, fog: "#141d38", near: 22, far: 60, expo: 0.92, luces: 1.0 },
    };
  }
  _secuencia() {
    return [["amanecer", 0.12], ["dia", 0.46], ["atardecer", 0.12], ["noche", 0.3]];
  }
  _fase() {
    const f = (this._diaT % this.CICLO) / this.CICLO;
    const seq = this._secuencia();
    let acc = 0;
    for (let i = 0; i < seq.length; i++) {
      const [n, d] = seq[i];
      if (f < acc + d) return { actual: n, siguiente: seq[(i + 1) % seq.length][0], k: (f - acc) / d };
      acc += d;
    }
    return { actual: "dia", siguiente: "atardecer", k: 0 };
  }
  _lerpHex(a, b, t) {
    return new THREE.Color(a).lerp(new THREE.Color(b), t);
  }
  _pintarCielo(top, bot) {
    if (!this._cieloCanvas) {
      this._cieloCanvas = document.createElement("canvas");
      this._cieloCanvas.width = 8;
      this._cieloCanvas.height = 256;
      this._cieloCtx = this._cieloCanvas.getContext("2d");
      this._cieloTex = new THREE.CanvasTexture(this._cieloCanvas);
      this._cieloTex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = this._cieloTex;
    }
    const ctx = this._cieloCtx;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#" + top.getHexString());
    g.addColorStop(1, "#" + bot.getHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    this._cieloTex.needsUpdate = true;
  }
  _setMomento({ actual, siguiente, k }) {
    const P = this._paletas(), a = P[actual], b = P[siguiente];
    this._pintarCielo(this._lerpHex(a.top, b.top, k), this._lerpHex(a.bot, b.bot, k));
    if (this.sol) {
      this.sol.color.copy(this._lerpHex(new THREE.Color(a.sol), new THREE.Color(b.sol), k));
      this.sol.intensity = a.solI + (b.solI - a.solI) * k;
    }
    if (this.hemi) this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    if (this.scene.fog) {
      this.scene.fog.color.copy(this._lerpHex(a.fog, b.fog, k));
      this.scene.fog.near = a.near + (b.near - a.near) * k;
      this.scene.fog.far = a.far + (b.far - a.far) * k;
    }
    this.renderer.toneMappingExposure = a.expo + (b.expo - a.expo) * k;
    const on = a.luces + (b.luces - a.luces) * k;
    if (this._luces) for (const m of this._luces) m.emissiveIntensity = 0.35 + on * 1.15;
    if (this.estrellas) this.estrellas.material.opacity = Math.max(0, (on - 0.45) / 0.55);
    if (this.grillos) this.grillos.setVolume(on * 0.35); // grillos: suben de noche, suaves

  }
  _tickDia(dt) {
    this._diaT += dt;
    this._diaAcc = (this._diaAcc || 0) + dt;
    if (this._diaAcc < 0.1) return;
    this._diaAcc = 0;
    this._setMomento(this._fase());
    this._guardarAcc = (this._guardarAcc || 0) + 0.1;
    if (this._guardarAcc >= 5) {
      this._guardarAcc = 0;
      localStorage.setItem("anima:diaT", String(Math.floor(this._diaT)));
    }
  }

  _casa(x, z, color, w, h) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true }));
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = this.sombrasOn;
    this.occluders.push(m);
    this.scene.add(m);
    const techo = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.85, 2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 1, flatShading: true, transparent: true })
    );
    techo.position.set(x, h + 1, z);
    techo.rotation.y = Math.PI / 4;
    techo.castShadow = this.sombrasOn;
    this.occluders.push(techo);
    this.scene.add(techo);
    // fachada (+z): puerta + 2 ventanas emisivas
    const puerta = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 1 }));
    puerta.position.set(x, 0.8, z + w / 2 + 0.01);
    this.scene.add(puerta);
    const vmat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84d, emissiveIntensity: 0.35, roughness: 1 });
    this._luces.push(vmat);
    for (const dx of [-w / 4, w / 4]) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), vmat);
      v.position.set(x + dx, h * 0.62, z + w / 2 + 0.01);
      this.scene.add(v);
    }
  }

  _props() {
    const troncoG = new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6);
    const troncoM = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 1 });
    const copaG = new THREE.IcosahedronGeometry(1.1, 0);
    const copaM = new THREE.MeshStandardMaterial({ color: 0x4f8a3f, roughness: 1, flatShading: true });
    const posteG = new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6);
    const posteM = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1 });
    const bombillaG = new THREE.SphereGeometry(0.16, 10, 10);
    const bombillaM = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf6a, emissiveIntensity: 0.6, roughness: 1 });
    this._luces.push(bombillaM);

    const arbol = (x, z) => {
      const t = new THREE.Mesh(troncoG, troncoM);
      t.position.set(x, 0.7, z);
      const c = new THREE.Mesh(copaG, copaM);
      c.position.set(x, 2.0, z);
      if (this.sombrasOn) { t.castShadow = true; c.castShadow = true; }
      this.scene.add(t, c);
    };
    const farola = (x, z) => {
      const p = new THREE.Mesh(posteG, posteM);
      p.position.set(x, 1.1, z);
      const b = new THREE.Mesh(bombillaG, bombillaM);
      b.position.set(x, 2.3, z);
      if (this.sombrasOn) p.castShadow = true;
      this.scene.add(p, b);
    };

    const R = 17;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      arbol(Math.cos(a) * R, Math.sin(a) * R);
    }
    farola(4.5, 4.5);
    farola(-4.5, 4.5);
    farola(0, -5.5);
  }

  _npc(p) {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(this.G.capsula, new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color || "#cccccc"), roughness: 0.85 }));
    cuerpo.position.y = 0.95;
    const cabeza = new THREE.Mesh(this.G.cabeza, this.M.piel);
    cabeza.position.y = 1.75;
    if (this.sombrasOn) { cuerpo.castShadow = true; cabeza.castShadow = true; }
    g.add(cuerpo, cabeza, etiqueta(p.nombre, "#fff"));
    g.position.set(p.pos[0], 0, p.pos[2]);
    g.userData.npc = p;
    g.userData.meshes = [cuerpo, cabeza];
    this.scene.add(g);
    // sombra de contacto fija (ancla el flotar; funciona aunque shadowMap esté off en móvil)
    const sombra = new THREE.Mesh(this.G.disco, this.M.sombra);
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.set(p.pos[0], 0.015, p.pos[2]);
    this.scene.add(sombra);
    return g;
  }

  _bind(canvas) {
    canvas.tabIndex = -1; // permite re-enfocar el canvas al cerrar el chat (WASD vuelve a responder)
    // cursor contextual: mano sobre un NPC
    let mmRaf = null;
    addEventListener("pointermove", (e) => {
      if (mmRaf || this.locked) return;
      mmRaf = requestAnimationFrame(() => {
        mmRaf = null;
        const r = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(mouse, this.camera);
        const hit = this.raycaster.intersectObjects(this.npcs.flatMap((n) => n.userData.meshes), false).length > 0;
        document.body.classList.toggle("sobre-npc", hit);
      });
    });
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
      const mouse = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(mouse, this.camera);
      // 1) clic sobre un NPC -> si estás cerca habla; si no, ve hacia él y habla al llegar
      const hits = this.raycaster.intersectObjects(this.npcs.flatMap((n) => n.userData.meshes), false);
      if (hits.length) {
        const g = hits[0].object.parent;
        if (g.position.distanceTo(this.player.position) <= RADIO_INTERACCION) {
          this.onInteract(g.userData.npc);
        } else {
          this.moveTarget = g.position.clone();
          this.pendingTalk = g.userData.npc;
          this._marcarDestino(g.position, g.userData.npc.color);
        }
        return;
      }
      // 2) clic en el suelo -> caminar hasta ese punto
      const pt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, pt)) {
        pt.x = Math.max(-LIMITE, Math.min(LIMITE, pt.x));
        pt.z = Math.max(-LIMITE, Math.min(LIMITE, pt.z));
        this.moveTarget = pt;
        this.pendingTalk = null;
        this._marcarDestino(pt, 0xffe066);
      }
    });
  }

  _marcarDestino(pos, color) {
    this.clickMarker.material.color.set(color);
    this.clickMarker.position.set(pos.x, 0.02, pos.z);
    this.clickMarker.visible = true;
  }

  _bindTouch() {
    const esTactil = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!esTactil) return;
    document.body.classList.add("touch");
    const base = document.getElementById("joy-base");
    const knob = document.getElementById("joy-knob");
    if (!base || !knob) return;
    let id = null, cx = 0, cy = 0;
    const R = 46;
    const set = (t) => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, R);
      dx = (dx / d) * cl; dy = (dy / d) * cl;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / R;
      this.move.z = dy / R;
    };
    const reset = () => { id = null; this.move.x = 0; this.move.z = 0; knob.style.transform = "translate(0,0)"; };
    base.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; id = t.identifier;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      set(t);
    }, { passive: false });
    base.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) set(t);
    }, { passive: false });
    base.addEventListener("touchend", (e) => { for (const t of e.changedTouches) if (t.identifier === id) reset(); });
    base.addEventListener("touchcancel", reset);
  }

  resize() {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    if (w === 0 || h === 0) return;
    this._setDPR();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLocked(v) {
    this.locked = v;
    if (v) {
      this.moveTarget = null;
      this.pendingTalk = null;
      if (this.clickMarker) this.clickMarker.visible = false;
    }
    Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
  }

  // Audio: se arranca tras un gesto del usuario (botón Entrar). Carga ficheros de ./audio/
  // si existen; si no, silencio sin errores. Pon: audio/grillos.mp3 y audio/cantina.mp3.
  iniciarAudio() {
    if (this._audioOn) return;
    this._audioOn = true;
    const loader = new THREE.AudioLoader();
    this.grillos = new THREE.Audio(this.listener);
    this.grillos.setLoop(true);
    this.grillos.setVolume(0);
    // si no hay fichero, usa un placeholder sintetizado (sin descargas ni licencias)
    loader.load("./audio/grillos.mp3",
      (b) => { this.grillos.setBuffer(b); this.grillos.play(); },
      undefined,
      () => { this.grillos.setBuffer(this._bufGrillos()); this.grillos.play(); });
    this.cantina = new THREE.PositionalAudio(this.listener);
    this.cantina.setRefDistance(3.5);
    this.cantina.setMaxDistance(14);
    this.cantina.setRolloffFactor(2.2);
    this.cantina.setLoop(true);
    this.cantina.setVolume(0.7);
    const ancla = new THREE.Object3D();
    ancla.position.set(-9, 1.4, -5); // puerta de la taberna de Bruno
    ancla.add(this.cantina);
    this.scene.add(ancla);
    loader.load("./audio/cantina.mp3",
      (b) => { this.cantina.setBuffer(b); this.cantina.play(); },
      undefined,
      () => { this.cantina.setBuffer(this._bufMelodia()); this.cantina.play(); });
  }

  // Placeholder de grillos: chirridos suaves y periódicos (se sustituye con audio/grillos.mp3).
  _bufGrillos() {
    const ctx = this.listener.context, sr = ctx.sampleRate, dur = 4, n = sr * dur;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let t = 0; t < dur - 0.2; t += 0.32 + Math.random() * 0.05) {
      const start = Math.floor(t * sr), len = Math.floor(0.11 * sr);
      for (let i = 0; i < len; i++) {
        const tt = i / sr;
        const env = Math.exp(-tt * 16) * (0.55 + 0.45 * Math.sin(tt * 2 * Math.PI * 42));
        if (start + i < n) d[start + i] += Math.sin(2 * Math.PI * 4550 * tt) * env * 0.1;
      }
    }
    return buf;
  }

  // Placeholder de melodía de taberna: tonada suave en bucle (se sustituye con audio/cantina.mp3).
  _bufMelodia() {
    const ctx = this.listener.context, sr = ctx.sampleRate, dur = 8, n = sr * dur;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const notas = [294, 370, 440, 370, 330, 247, 294, 330];
    const paso = dur / notas.length;
    notas.forEach((f, idx) => {
      const start = Math.floor(idx * paso * sr), len = Math.floor(paso * sr);
      for (let i = 0; i < len; i++) {
        const tt = i / sr;
        const env = Math.min(1, tt * 18) * Math.exp(-tt * 1.6);
        if (start + i < n) d[start + i] += (Math.sin(2 * Math.PI * f * tt) * 0.6 + Math.sin(2 * Math.PI * f * 2 * tt) * 0.18) * env * 0.09;
      }
    });
    return buf;
  }

  toggleMute() {
    this._muted = !this._muted;
    this.listener.setMasterVolume(this._muted ? 0 : 1);
    return this._muted;
  }

  // Carga el modelo del jugador (models/jugador.glb) si existe. Defensivo: si no hay
  // fichero o falla, se queda la cápsula azul. Auto-escala a ~1,8 m y usa idle/walk.
  async _cargarModeloJugador() {
    try {
      const ping = await fetch("./models/jugador.glb", { method: "HEAD" });
      if (!ping.ok) return; // no hay modelo: se queda la cápsula
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync("./models/jugador.glb");
      const obj = gltf.scene;
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const alto = box.max.y - box.min.y || 1.8;
      const s = 0.72 / alto; // 1/3 + 20%
      obj.scale.setScalar(s);
      obj.position.y = -box.min.y * s; // pies a y=0 con el modelo ya escalado (sin levitar)
      obj.traverse((o) => { if (o.isMesh) o.castShadow = this.sombrasOn; });
      if (this.playerCapsule) this.playerCapsule.visible = false;
      this.player.add(obj);
      this.modelo = obj;
      if (gltf.animations && gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(obj);
        const find = (re) => gltf.animations.find((a) => re.test(a.name));
        const idle = find(/idle|stand|quiet/i) || gltf.animations[0];
        const walk = find(/walk|camin|run/i) || gltf.animations[1] || idle;
        this.animIdle = this.mixer.clipAction(idle);
        this.animWalk = this.mixer.clipAction(walk);
        this.animIdle.play();
        this._animActual = "idle";
      }
    } catch (e) {
      /* sin modelo: se queda la cápsula */
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    if (document.hidden) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.locked) {
      const v = 6 * dt;
      let mx = 0, mz = 0;
      if (this.keys["a"] || this.keys["arrowleft"]) mx -= 1;
      if (this.keys["d"] || this.keys["arrowright"]) mx += 1;
      if (this.keys["w"] || this.keys["arrowup"]) mz -= 1;
      if (this.keys["s"] || this.keys["arrowdown"]) mz += 1;
      mx += this.move.x;
      mz += this.move.z;
      const manual = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
      if (manual) {
        // teclado/joystick cancela el destino de point-and-click
        this.moveTarget = null;
        this.pendingTalk = null;
        this.clickMarker.visible = false;
      } else if (this.moveTarget) {
        const dx = this.moveTarget.x - this.player.position.x;
        const dz = this.moveTarget.z - this.player.position.z;
        const d = Math.hypot(dx, dz);
        const stop = this.pendingTalk ? RADIO_INTERACCION - 1.4 : 0.18;
        if (d <= stop) {
          this.moveTarget = null;
          this.clickMarker.visible = false;
          if (this.pendingTalk) {
            const npc = this.pendingTalk;
            this.pendingTalk = null;
            this.onInteract(npc);
          }
        } else {
          mx = dx / d;
          mz = dz / d;
        }
      }
      const mag = Math.hypot(mx, mz);
      this._moving = mag > 0.01;
      if (mag > 1) { mx /= mag; mz /= mag; }
      if (this._moving && this.modelo) this.player.rotation.y = Math.atan2(mx, mz); // mira hacia donde anda
      this.player.position.x = Math.max(-LIMITE, Math.min(LIMITE, this.player.position.x + mx * v));
      this.player.position.z = Math.max(-LIMITE, Math.min(LIMITE, this.player.position.z + mz * v));
    }

    const p = this.player.position;
    this.camera.position.lerp(this.tmp.set(p.x, 9, p.z + 12), 0.12);
    this.camera.lookAt(p.x, 1.2, p.z);

    // Con el chat abierto, renderiza a ~4fps (solo para asentar la cámara) y libera la GPU para la IA.
    if (this.locked) {
      this._acc = (this._acc || 0) + dt;
      if (this._acc < 0.25) return;
      this._acc = 0;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const t = this.clock.elapsedTime;
    this.npcs.forEach((n, i) => {
      n.rotation.y = Math.sin(t * 0.5 + i) * 0.4;
      n.position.y = Math.sin(t * 1.5 + i) * 0.04;
    });
    this.playerShadow.position.set(p.x, 0.016, p.z);

    // animación del modelo del jugador (idle <-> walk)
    if (this.mixer) {
      this.mixer.update(dt);
      if (this.animWalk && this.animIdle) {
        const quiero = this._moving ? "walk" : "idle";
        if (quiero !== this._animActual) {
          const to = quiero === "walk" ? this.animWalk : this.animIdle;
          const from = quiero === "walk" ? this.animIdle : this.animWalk;
          to.reset().fadeIn(0.2).play();
          from.fadeOut(0.2);
          this._animActual = quiero;
        }
      }
    }
    this._tickDia(dt);
    if (this.clickMarker.visible) {
      this._mk = (this._mk || 0) + dt;
      const s = 1 + Math.sin(this._mk * 6) * 0.12;
      this.clickMarker.scale.set(s, s, s);
      this.clickMarker.material.opacity = 0.55 + Math.sin(this._mk * 6) * 0.3;
    }

    // Oclusión estilo BG3: lo que tape al jugador (entre cámara y jugador) se vuelve translúcido
    if (this.occluders.length) {
      const head = this.tmp2.set(p.x, 1.2, p.z);
      const dist = head.distanceTo(this.camera.position);
      this.occRay.set(this.camera.position, head.sub(this.camera.position).normalize());
      this.occRay.far = dist;
      const tapan = new Set(this.occRay.intersectObjects(this.occluders, false).map((h) => h.object));
      for (const o of this.occluders) {
        const target = tapan.has(o) ? 0.25 : 1;
        o.material.opacity += (target - o.material.opacity) * 0.16;
      }
    }

    let cerca = null, dmin = RADIO_INTERACCION;
    for (const n of this.npcs) {
      const d = n.position.distanceTo(p);
      if (d < dmin) { dmin = d; cerca = n; }
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
