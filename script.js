/* =========================================================================
   CUBETIMER — script.js
   Sections: 1) scramble engine  2) 3D cube renderer  3) stats engine
             4) app / timer controller
   ========================================================================= */

/* ---------------------------------------------------------------------- *
 * 1) SCRAMBLE ENGINE
 * ---------------------------------------------------------------------- */
const FACES = ["U", "D", "L", "R", "F", "B"];
const AXIS_OF = { U: "y", D: "y", L: "x", R: "x", F: "z", B: "z" };
const MODIFIERS = ["", "'", "2"];
const SCRAMBLE_LENGTH = { 2: 9, 3: 20, 4: 42, 5: 60 };
const WIDE_CHANCE = { 2: 0, 3: 0, 4: 0.4, 5: 0.45 };

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateScramble(size) {
  const length = SCRAMBLE_LENGTH[size] || 20;
  const wideChance = WIDE_CHANCE[size] || 0;
  const moves = [];
  let lastAxis = null, lastFace = null;
  for (let i = 0; i < length; i++) {
    let face;
    do { face = randItem(FACES); } while (face === lastFace || AXIS_OF[face] === lastAxis);
    const wide = wideChance > 0 && Math.random() < wideChance;
    const modifier = randItem(MODIFIERS);
    let notation = face + (wide ? "w" : "") + modifier;
    moves.push({ face, wide, modifier, notation });
    lastAxis = AXIS_OF[face];
    lastFace = face;
  }
  return moves;
}
function scrambleToString(moves) { return moves.map((m) => m.notation).join(" "); }

/* ---------------------------------------------------------------------- *
 * 2) 3D CUBE RENDERER (exact-matrix move logic, no float drift)
 * ---------------------------------------------------------------------- */
function matMul(a, b) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
    r[i][j] = s;
  }
  return r;
}
function matVec(a, v) {
  return [
    a[0][0]*v[0]+a[0][1]*v[1]+a[0][2]*v[2],
    a[1][0]*v[0]+a[1][1]*v[1]+a[1][2]*v[2],
    a[2][0]*v[0]+a[2][1]*v[1]+a[2][2]*v[2],
  ];
}
function transpose(m) { return [[m[0][0],m[1][0],m[2][0]],[m[0][1],m[1][1],m[2][1]],[m[0][2],m[1][2],m[2][2]]]; }

const I3 = [[1,0,0],[0,1,0],[0,0,1]];
const Rx90=[[1,0,0],[0,0,-1],[0,1,0]], RxN90=[[1,0,0],[0,0,1],[0,-1,0]];
const Ry90=[[0,0,1],[0,1,0],[-1,0,0]], RyN90=[[0,0,-1],[0,1,0],[1,0,0]];
const Rz90=[[0,-1,0],[1,0,0],[0,0,1]], RzN90=[[0,1,0],[-1,0,0],[0,0,1]];
const FACE_BASE = { U: RyN90, D: Ry90, L: Rx90, R: RxN90, F: RzN90, B: Rz90 };
const AXIS_INDEX = { U:1, D:1, L:0, R:0, F:2, B:2 };
const POSITIVE_SIDE = { U:true, D:false, L:false, R:true, F:true, B:false };

function getFaceMatrix(face, modifier) {
  const base = FACE_BASE[face];
  if (modifier === "") return base;
  if (modifier === "'") return transpose(base);
  return matMul(base, base);
}

const STICKER = { U:0xf4f4f4, D:0xffd400, F:0x2ecc55, B:0x2f6fe0, L:0xff8a1e, R:0xe83b3b };
const PLASTIC = 0x14161a;
const FACE_DIRS = [
  { key:"R", axis:0, side:1,  normal:[1,0,0] },
  { key:"L", axis:0, side:-1, normal:[-1,0,0] },
  { key:"U", axis:1, side:1,  normal:[0,1,0] },
  { key:"D", axis:1, side:-1, normal:[0,-1,0] },
  { key:"F", axis:2, side:1,  normal:[0,0,1] },
  { key:"B", axis:2, side:-1, normal:[0,0,-1] },
];

class CubeVisualizer {
  constructor(container, opts) {
    this.container = container;
    this.n = (opts && opts.size) || 3;
    this.animToken = 0;
    this.reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this._initScene();
    this._buildCube(this.n);
    this._bindDrag();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
    window.addEventListener("resize", () => this._resize());
  }

  _initScene() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(4.4, 4.0, 6.4);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.viewGroup = new THREE.Group();
    this.viewGroup.rotation.set(0.5, -0.7, 0);
    this.scene.add(this.viewGroup);
    this.cubeGroup = new THREE.Group();
    this.viewGroup.add(this.cubeGroup);

    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(5, 8, 6);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35); fill.position.set(-6, -2, -4);
    this.scene.add(amb, key, fill);
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _bindDrag() {
    const el = this.renderer.domElement;
    let dragging = false, px = 0, py = 0;
    this.autoRotate = true;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => {
      dragging = true; this.autoRotate = false; px = e.clientX; py = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      this.viewGroup.rotation.y += dx * 0.008;
      this.viewGroup.rotation.x += dy * 0.008;
      this.viewGroup.rotation.x = Math.max(-1.4, Math.min(1.4, this.viewGroup.rotation.x));
    });
    const end = () => { dragging = false; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointerleave", end);
  }

  _animate() {
    requestAnimationFrame(this._animate);
    if (this.autoRotate && !this.reducedMotion) this.viewGroup.rotation.y += 0.0028;
    this.renderer.render(this.scene, this.camera);
  }

  _buildCube(n) {
    if (this.cubeGroup) {
      while (this.cubeGroup.children.length) {
        const obj = this.cubeGroup.children.pop();
        obj.traverse((o) => {
          if (o.geometry && o.geometry.type === "PlaneGeometry") o.geometry.dispose();
          if (o.material && o.geometry && o.geometry.type === "PlaneGeometry") o.material.dispose();
        });
      }
    }
    this.n = n;
    this.cubieSize = 0.92; this.gap = 0.06; this.spacing = this.cubieSize + this.gap;
    this.cubies = [];
    const geo = new THREE.BoxGeometry(this.cubieSize, this.cubieSize, this.cubieSize);
    const plasticMat = new THREE.MeshPhongMaterial({ color: PLASTIC, shininess: 15 });

    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      if (i>0 && i<n-1 && j>0 && j<n-1 && k>0 && k<n-1) continue;
      const grid = [i, j, k];
      const pos2 = [2*i-(n-1), 2*j-(n-1), 2*k-(n-1)];
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geo, plasticMat));
      for (const f of FACE_DIRS) {
        const gridVal = grid[f.axis];
        const onBoundary = f.side === 1 ? gridVal === n-1 : gridVal === 0;
        if (!onBoundary) continue;
        const stickerGeo = new THREE.PlaneGeometry(this.cubieSize*0.84, this.cubieSize*0.84);
        const stickerMat = new THREE.MeshPhongMaterial({ color: STICKER[f.key], shininess: 40 });
        const plane = new THREE.Mesh(stickerGeo, stickerMat);
        const off = this.cubieSize/2 + 0.012;
        plane.position.set(f.normal[0]*off, f.normal[1]*off, f.normal[2]*off);
        if (f.axis === 0) plane.rotation.y = f.side === 1 ? Math.PI/2 : -Math.PI/2;
        else if (f.axis === 1) plane.rotation.x = f.side === 1 ? -Math.PI/2 : Math.PI/2;
        else plane.rotation.y = f.side === 1 ? 0 : Math.PI;
        group.add(plane);
      }
      this.cubeGroup.add(group);
      const cubie = { mesh: group, pos2, orient: I3.map((r) => r.slice()) };
      this.cubies.push(cubie);
      this._syncMesh(cubie);
    }
  }

  _syncMesh(cubie) {
    const s = this.spacing / 2;
    cubie.mesh.position.set(cubie.pos2[0]*s, cubie.pos2[1]*s, cubie.pos2[2]*s);
    const m = cubie.orient;
    const m4 = new THREE.Matrix4().set(
      m[0][0], m[0][1], m[0][2], 0,
      m[1][0], m[1][1], m[1][2], 0,
      m[2][0], m[2][1], m[2][2], 0,
      0, 0, 0, 1
    );
    cubie.mesh.quaternion.setFromRotationMatrix(m4);
  }

  resetSolved(size) { this._buildCube(size != null ? size : this.n); }
  setSize(size) { this._buildCube(size); }

  async applyMoves(moves, opts) {
    const options = Object.assign({ msPerMove: 90 }, opts);
    const myToken = ++this.animToken;
    for (const mv of moves) {
      if (myToken !== this.animToken) return;
      await this._applyOneMove(mv, options.msPerMove, myToken);
    }
  }
  cancelAnimations() { this.animToken++; }

  _applyOneMove(move, msPerMove, myToken) {
    const { face, wide, modifier } = move;
    const n = this.n;
    const M = getFaceMatrix(face, modifier);
    const axis = AXIS_INDEX[face];
    const positive = POSITIVE_SIDE[face];
    const maxCoord = n - 1;
    const layerVals = [];
    if (positive) { layerVals.push(maxCoord); if (wide) layerVals.push(maxCoord-2); }
    else { layerVals.push(-maxCoord); if (wide) layerVals.push(-maxCoord+2); }
    const affected = this.cubies.filter((c) => layerVals.includes(c.pos2[axis]));

    if (this.reducedMotion) {
      for (const c of affected) { c.pos2 = matVec(M, c.pos2); c.orient = matMul(M, c.orient); this._syncMesh(c); }
      return Promise.resolve();
    }

    const pivot = new THREE.Group();
    this.cubeGroup.add(pivot);
    for (const c of affected) pivot.attach(c.mesh);

    const m4 = new THREE.Matrix4().set(
      M[0][0], M[0][1], M[0][2], 0,
      M[1][0], M[1][1], M[1][2], 0,
      M[2][0], M[2][1], M[2][2], 0,
      0, 0, 0, 1
    );
    const targetQ = new THREE.Quaternion().setFromRotationMatrix(m4);
    const startQ = new THREE.Quaternion();

    return new Promise((resolve) => {
      const duration = modifier === "2" ? msPerMove * 1.25 : msPerMove;
      const start = performance.now();
      const step = (now) => {
        if (myToken !== this.animToken) { resolve(); return; }
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        pivot.quaternion.slerpQuaternions(startQ, targetQ, eased);
        if (t < 1) { requestAnimationFrame(step); }
        else {
          for (const c of affected) {
            c.pos2 = matVec(M, c.pos2);
            c.orient = matMul(M, c.orient);
            this.cubeGroup.attach(c.mesh);
            this._syncMesh(c);
          }
          this.cubeGroup.remove(pivot);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }
}

/* ---------------------------------------------------------------------- *
 * 3) STATS ENGINE
 * ---------------------------------------------------------------------- */
function effective(t) {
  if (t.penalty === "DNF") return Infinity;
  if (t.penalty === "+2") return t.time + 2;
  return t.time;
}
function trimCount(n) { if (n < 5) return 0; if (n <= 12) return 1; return Math.max(1, Math.round(n * 0.05)); }
function average(times) {
  const n = times.length, trim = trimCount(n);
  if (n < 5) return null;
  const vals = times.map(effective).sort((a, b) => a - b);
  const dnfCount = vals.filter((v) => v === Infinity).length;
  if (dnfCount > trim) return "DNF";
  const trimmed = vals.slice(trim, n - trim);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}
function currentAvg(times, n) { if (times.length < n) return null; return average(times.slice(-n)); }
function bestAvg(times, n) {
  if (times.length < n) return null;
  let best = null;
  for (let i = 0; i + n <= times.length; i++) {
    const a = average(times.slice(i, i + n));
    if (a === "DNF" || a === null) continue;
    if (best === null || a < best) best = a;
  }
  return best;
}
function computeStats(times) {
  const valid = times.filter((t) => t.penalty !== "DNF");
  const best = valid.length ? Math.min(...valid.map(effective)) : null;
  const worst = valid.length ? Math.max(...valid.map(effective)) : null;
  const mean = valid.length ? valid.reduce((a, t) => a + effective(t), 0) / valid.length : null;
  return {
    count: times.length, best, worst, mean,
    ao5: currentAvg(times, 5), ao12: currentAvg(times, 12),
    ao50: currentAvg(times, 50), ao100: currentAvg(times, 100),
    bestAo5: bestAvg(times, 5), bestAo12: bestAvg(times, 12),
  };
}
function fmt(t) {
  if (t === null || t === undefined) return "-";
  if (t === "DNF" || t === Infinity) return "DNF";
  const mins = Math.floor(t / 60), secs = t - mins * 60;
  return mins > 0 ? `${mins}:${secs.toFixed(3).padStart(6, "0")}` : secs.toFixed(3);
}

/* ---------------------------------------------------------------------- *
 * 4) APP / TIMER CONTROLLER
 * ---------------------------------------------------------------------- */
const STORAGE_KEY = "cubetimer:data:v1";
const SETTINGS_KEY = "cubetimer:settings:v1";
const HOLD_THRESHOLD = 300; // ms to arm "ready"

let data = loadData();
let settings = loadSettings();
let size = 3;
let currentScramble = generateScramble(size);
let idCounter = Date.now();

let appState = "idle"; // idle | inspecting | holding | running
let holdStart = 0, inspectionStart = 0, runStart = 0, rafId = null, inspectionInterval = null;
let pendingPenalty = null;

const els = {
  timer: document.getElementById("timer"),
  timerStatus: document.getElementById("timerStatus"),
  scramble: document.getElementById("scramble"),
  qsBest: document.getElementById("qsBest"),
  qsAo5: document.getElementById("qsAo5"),
  qsAo12: document.getElementById("qsAo12"),
  qsMean: document.getElementById("qsMean"),
  qsCount: document.getElementById("qsCount"),
  stBestAo5: document.getElementById("stBestAo5"),
  stBestAo12: document.getElementById("stBestAo12"),
  stAo50: document.getElementById("stAo50"),
  stAo100: document.getElementById("stAo100"),
  stWorst: document.getElementById("stWorst"),
  times: document.getElementById("times"),
  chart: document.getElementById("chart"),
  sizeTabs: document.querySelectorAll(".size-tab"),
  resetBtn: document.getElementById("resetBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  closeSettings: document.getElementById("closeSettings"),
  settingsPanel: document.getElementById("settingsPanel"),
  inspectionToggle: document.getElementById("inspectionToggle"),
  soundToggle: document.getElementById("soundToggle"),
};

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { 2: raw[2] || [], 3: raw[3] || [], 4: raw[4] || [], 5: raw[5] || [] };
  } catch (e) { return { 2: [], 3: [], 4: [], 5: [] }; }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function loadSettings() {
  try { return Object.assign({ inspection: false, sound: true }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
  catch (e) { return { inspection: false, sound: true }; }
}
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

/* ---- audio cues ---- */
let audioCtx = null;
function beep(freq, duration) {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

/* ---- cube visualizer ---- */
const cubeViz = new CubeVisualizer(document.getElementById("cube-container"), { size });

function newScrambleAndAnimate() {
  currentScramble = generateScramble(size);
  els.scramble.textContent = scrambleToString(currentScramble);
  cubeViz.resetSolved(size);
  cubeViz.applyMoves(currentScramble, { msPerMove: 85 });
}

/* ---- timer state machine ---- */
function setTimerClass(cls) {
  els.timer.className = "timer" + (cls ? " " + cls : "");
}

function tickRunning() {
  const elapsed = (performance.now() - runStart) / 1000;
  els.timer.textContent = elapsed.toFixed(3);
  rafId = requestAnimationFrame(tickRunning);
}

function startInspection() {
  appState = "inspecting";
  inspectionStart = performance.now();
  setTimerClass("state-inspecting");
  els.timerStatus.textContent = "inspecting — hold space when ready";
  let warned8 = false, warned12 = false;
  inspectionInterval = setInterval(() => {
    const elapsed = (performance.now() - inspectionStart) / 1000;
    const remaining = Math.max(0, 15 - elapsed);
    els.timer.textContent = remaining > 0 ? Math.ceil(remaining).toString() : "+2";
    if (elapsed >= 8 && !warned8) { warned8 = true; beep(700, 0.12); }
    if (elapsed >= 12 && !warned12) { warned12 = true; beep(700, 0.12); }
    if (elapsed >= 17) {
      clearInterval(inspectionInterval);
      beep(220, 0.3);
      els.timerStatus.textContent = "inspection expired — DNF";
      setTimeout(() => resetToIdle(), 900);
    }
  }, 100);
}

function armHold() {
  appState = "holding";
  holdStart = performance.now();
  setTimerClass("");
  els.timerStatus.textContent = "keep holding…";
}

function releaseHold(fromInspection) {
  const held = performance.now() - holdStart;
  if (held < (fromInspection ? 120 : HOLD_THRESHOLD)) {
    // released too early — cancel
    if (fromInspection) { appState = "inspecting"; els.timerStatus.textContent = "inspecting — hold space when ready"; setTimerClass("state-inspecting"); }
    else { resetToIdle(); }
    return;
  }
  if (fromInspection) {
    const elapsed = (performance.now() - inspectionStart) / 1000;
    clearInterval(inspectionInterval);
    if (elapsed >= 17) pendingPenalty = "DNF";
    else if (elapsed >= 15) pendingPenalty = "+2";
    else pendingPenalty = null;
  }
  startRunning();
}

function startRunning() {
  appState = "running";
  runStart = performance.now();
  setTimerClass("state-running");
  els.timerStatus.textContent = "press space to stop";
  beep(880, 0.08);
  rafId = requestAnimationFrame(tickRunning);
}

function stopRunning() {
  cancelAnimationFrame(rafId);
  const elapsed = (performance.now() - runStart) / 1000;
  els.timer.textContent = elapsed.toFixed(3);
  beep(440, 0.1);
  recordSolve(elapsed, pendingPenalty);
  pendingPenalty = null;
  appState = "idle";
  setTimerClass("");
  els.timerStatus.textContent = "hold space to start";
}

function resetToIdle() {
  clearInterval(inspectionInterval);
  cancelAnimationFrame(rafId);
  appState = "idle";
  pendingPenalty = null;
  setTimerClass("");
  els.timer.textContent = "0.000";
  els.timerStatus.textContent = "hold space to start";
}

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  e.preventDefault();
  if (appState === "idle") {
    if (settings.inspection) startInspection(); else armHold();
  } else if (appState === "inspecting") {
    armHoldDuringInspection();
  } else if (appState === "running") {
    stopRunning();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;
  if (appState === "holding") releaseHold(false);
  else if (appState === "holding-insp") releaseHold(true);
});
function armHoldDuringInspection() {
  appState = "holding-insp";
  holdStart = performance.now();
  setTimerClass("state-ready");
}

/* ---- solve recording ---- */
function recordSolve(time, penalty) {
  const entry = { id: ++idCounter, time, penalty: penalty || null, scramble: scrambleToString(currentScramble), date: Date.now() };
  data[size].push(entry);
  saveData();
  renderAll();
  newScrambleAndAnimate();
}

/* ---- rendering ---- */
let chartInstance = null;

function renderAll() {
  const list = data[size];
  const stats = computeStats(list);

  els.qsBest.textContent = fmt(stats.best);
  els.qsAo5.textContent = fmt(stats.ao5);
  els.qsAo12.textContent = fmt(stats.ao12);
  els.qsMean.textContent = fmt(stats.mean);
  els.qsCount.textContent = stats.count;

  els.stBestAo5.textContent = fmt(stats.bestAo5);
  els.stBestAo12.textContent = fmt(stats.bestAo12);
  els.stAo50.textContent = fmt(stats.ao50);
  els.stAo100.textContent = fmt(stats.ao100);
  els.stWorst.textContent = fmt(stats.worst);

  renderTimesList(list);
  renderChart(list);
}

function renderTimesList(list) {
  const recent = list.slice(-30).reverse();
  els.times.innerHTML = recent.map((t, idx) => {
    const num = list.length - idx;
    const cls = t.penalty === "+2" ? "penalty-plus2" : t.penalty === "DNF" ? "penalty-dnf" : "";
    const label = t.penalty === "DNF" ? "DNF" : t.penalty === "+2" ? `${t.time.toFixed(3)}+2` : t.time.toFixed(3);
    return `<li class="${cls}" data-id="${t.id}" title="${t.scramble}">
      <span class="idx">${num}</span><span class="val">${label}</span><span class="del" data-del="${t.id}">✕</span>
    </li>`;
  }).join("");
}

els.times.addEventListener("click", (e) => {
  const delId = e.target.getAttribute && e.target.getAttribute("data-del");
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  const id = Number(delId || li.getAttribute("data-id"));
  const list = data[size];
  const entry = list.find((t) => t.id === id);
  if (!entry) return;
  if (delId) {
    data[size] = list.filter((t) => t.id !== id);
  } else {
    entry.penalty = entry.penalty === null ? "+2" : entry.penalty === "+2" ? "DNF" : null;
  }
  saveData();
  renderAll();
});

function renderChart(list) {
  const labels = list.map((_, i) => i + 1);
  const points = list.map((t) => (t.penalty === "DNF" ? null : effective(t)));
  const rolling = list.map((_, i) => {
    if (i < 4) return null;
    const a = average(list.slice(i - 4, i + 1));
    return a === "DNF" || a === null ? null : a;
  });

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(els.chart, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "solve", data: points, borderColor: "#3ddc84", backgroundColor: "transparent", pointRadius: 2, tension: 0.15, spanGaps: true },
        { label: "ao5", data: rolling, borderColor: "#5b8cff", borderDash: [4, 4], backgroundColor: "transparent", pointRadius: 0, tension: 0.2, spanGaps: true },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { beginAtZero: false, grid: { color: "#2a2e37" }, ticks: { color: "#8b8f9c" } },
      },
    },
  });
}

/* ---- size switching ---- */
function switchSize(n) {
  size = n;
  els.sizeTabs.forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.size) === n)));
  cubeViz.setSize(n);
  newScrambleAndAnimate();
  renderAll();
}
els.sizeTabs.forEach((btn) => btn.addEventListener("click", () => switchSize(Number(btn.dataset.size))));

/* ---- reset ---- */
els.resetBtn.addEventListener("click", () => {
  if (confirm(`Reset all ${size}×${size} times? This can't be undone.`)) {
    data[size] = [];
    saveData();
    renderAll();
  }
});

/* ---- settings panel ---- */
function openSettings() {
  els.inspectionToggle.checked = settings.inspection;
  els.soundToggle.checked = settings.sound;
  els.settingsPanel.hidden = false;
}
els.settingsBtn.addEventListener("click", openSettings);
els.closeSettings.addEventListener("click", () => (els.settingsPanel.hidden = true));
els.settingsPanel.addEventListener("click", (e) => { if (e.target === els.settingsPanel) els.settingsPanel.hidden = true; });
els.inspectionToggle.addEventListener("change", () => { settings.inspection = els.inspectionToggle.checked; saveSettings(); });
els.soundToggle.addEventListener("change", () => { settings.sound = els.soundToggle.checked; saveSettings(); });

/* ---- init ---- */
els.scramble.textContent = scrambleToString(currentScramble);
cubeViz.applyMoves(currentScramble, { msPerMove: 85 });
renderAll();