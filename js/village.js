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
    this.tmp = new THREE.Vector3();
    this.sombrasOn = !ES_MOVIL;

    // --- escena / cámara / render ---
    this.scene = new THREE.Scene();
    this.scene.background = cieloTextura();
    this.scene.fog = new THREE.Fog(0xc7dbd6, 34, 78);

    this.camera = new THREE.PerspectiveCamera(55, 2, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !ES_MOVIL });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this._setDPR = () => this.renderer.setPixelRatio(Math.min(devicePixelRatio, ES_MOVIL ? 1.5 : 2));
    this._setDPR();
    this.renderer.shadowMap.enabled = this.sombrasOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- luces ---
    this.scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x5a6b48, 0.85));
    const sol = new THREE.DirectionalLight(0xfff0d8, 1.55);
    sol.position.set(14, 20, 8);
    if (this.sombrasOn) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(1024, 1024);
      const s = 26;
      Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
      sol.shadow.bias = -0.0005;
      sol.shadow.normalBias = 0.04;
    }
    this.scene.add(sol);
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
    this.player.position.set(0, 0, -2);
    this.scene.add(this.player);
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

    this.raycaster = new THREE.Raycaster();
    this._bind(canvas);
    this._bindTouch();
    this.resize();
    this.clock = new THREE.Clock();
    this._loop();
  }

  _casa(x, z, color, w, h) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = this.sombrasOn;
    this.scene.add(m);
    const techo = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 2, 4), this.M.techo);
    techo.position.set(x, h + 1, z);
    techo.rotation.y = Math.PI / 4;
    techo.castShadow = this.sombrasOn;
    this.scene.add(techo);
    // fachada (+z): puerta + 2 ventanas emisivas
    const puerta = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 1 }));
    puerta.position.set(x, 0.8, z + w / 2 + 0.01);
    this.scene.add(puerta);
    const vmat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84d, emissiveIntensity: 0.35, roughness: 1 });
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
      const hits = this.raycaster.intersectObjects(this.npcs.flatMap((n) => n.userData.meshes), false);
      if (hits.length) {
        const npcGroup = hits[0].object.parent;
        if (npcGroup.position.distanceTo(this.player.position) <= RADIO_INTERACCION) {
          this.onInteract(npcGroup.userData.npc);
        }
      }
    });
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
    Object.keys(this.keys).forEach((k) => (this.keys[k] = false));
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
      const mag = Math.hypot(mx, mz);
      if (mag > 1) { mx /= mag; mz /= mag; }
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
