// Rothko Mirror · Interactive Walls #02 · ORE.XYZ (MAKE #09, 2026-11-08)
// You, seen in a bathroom mirror after a hot shower: the glass is steamed and
// you are only soft glowing masses of colour, in the deep, warm atmosphere of
// Rothko's paintings.
//
// How it works: the camera is read at a tiny size and given a soft Gaussian
// blur (that is the steam), slowed
// down (the steam follows you), then coloured: either your own colours, made
// richer, or your light and dark mapped onto a Rothko-like colour ramp.
//
// Layers (after Rothko's method, see README): a translucent stain ground that
// shows through, the main field, a thinner veil of another tone, a thin warm or
// cool line where light meets dark (his feathered edges), and an uneven final
// glaze, partly glossy, partly matte. Each layer drifts at its own slow speed.
//
// Time: the painting changes by itself over minutes, the way a Rothko seems
// to change while your eyes adjust: warmer or cooler, the veils thicker or
// thinner, a little lighter or deeper. Nothing reacts to you: you only look.
//
// Distance: near the glass you are steamy as always; step back and the blur
// grows until you dissolve into the colour and are no longer visible. Distance
// is guessed from the size of your face (MediaPipe face detector, Apache 2.0,
// on this device, ~10 times a second). No face found = far = not visible.
//
// Runs in p5.js 1.x and 2.x (p5 web editor OK). The camera image never leaves
// the browser and nothing is recorded.
// Keys: R next colours · F fullscreen · S save a still · D debug · H hide hint
// Set up on site: stand where you want to be clearest and press N (near);
// stand where you want to vanish and press G (gone). Saved in this browser.
// X forgets it (back to the numbers in SET).
// Click / tap: next colours.

const SET = {
  cols: 96,       // width of the tiny working image
  blur: 3,        // steam: 1 light, 2 soft, 3 steamy, 4 almost pure colour
  lag: 0.6,       // seconds the steam takes to follow you (ghost trails)
  sat: 1.5,       // richness of your own colours (1 = as the camera sees them)
  steam: 0.12,    // pale haze drifting over the glass (0 none)
  vignette: 0.35, // darker corners (0 none)
  floor: 1,       // shadows never darker than the set's deepest colour (0 = can go black)
  peak: 215,      // brightest any colour may get (255 = can burn to white)
  fields: 0,      // faint Rothko rectangles behind you (0 off, 1 visible)
  layers: 1,      // Rothko-like paint layers (0 = one flat colour ramp, as before)
  veils: 6,       // how many thin glazes over the field (each set lists up to 6)
  veilOpacity: 0.3, // how strong each glaze is
  drift: 1,       // how fast the layers drift (1 = very slow)
  slowChange: 1,  // how much the painting changes over minutes (0 = never)
  cycle: 2,       // roughly how many minutes one slow change takes
  depth: true,    // step back and you dissolve (needs the face detector)
  nearBlur: 2.0,  // blur when near (2.5 = the usual steam; never 0)
  farBlur: 7,     // blur when far, before you dissolve completely
  nearFace: 0.09, // face width (part of the picture) that counts as near: ~1.2 m from a usual webcam
  farFace: 0.045, // face width that counts as far, you are gone: ~2.4 m (the detector loses faces past ~2 m anyway)
  holdFace: 1,    // seconds to keep the last distance when the face is briefly lost
  depthEase: 1.5, // seconds the blur takes to follow you
};

// Colour sets. own: how much of your real colours shows (1 = only yours).
// ramp: your dark -> light mapped to these four colours.
// Inspired by the atmosphere of Rothko's paintings, not copies of any one.
// Layers: ground = the stain under everything, veils = thin glazes of other
// tones (odd ones sit in your light, even ones in the shadows), edge = the soft
// colour where light meets dark. Add or remove veils freely.
const SETS = [
  { name: 'blue', own: 0.15, ramp: [[22, 38, 96], [30, 58, 128], [44, 92, 170], [74, 132, 212]],
    ground: [74, 26, 58], edge: [124, 70, 128], warm: [1.12, 0.95, 1.0], cool: [0.88, 0.95, 1.05],
    veils: [[40, 40, 132], [18, 30, 84], [70, 104, 176], [72, 38, 108], [56, 76, 150], [30, 48, 112]] },
  { name: 'red', own: 0.15, ramp: [[100, 18, 22], [134, 24, 26], [176, 40, 32], [214, 74, 56]],
    ground: [62, 14, 42], edge: [226, 128, 48], warm: [1.04, 1.14, 0.9], cool: [0.94, 0.86, 1.12],
    veils: [[196, 66, 30], [96, 14, 40], [222, 98, 60], [128, 28, 28], [170, 40, 56], [82, 18, 22]] },
  { name: 'yellow', own: 0.15, ramp: [[156, 86, 22], [192, 120, 30], [228, 170, 46], [244, 204, 84]],
    ground: [176, 72, 22], edge: [206, 92, 42], warm: [1.0, 0.9, 0.78], cool: [0.98, 1.04, 1.08],
    veils: [[242, 194, 70], [176, 96, 26], [250, 220, 120], [196, 110, 34], [232, 168, 52], [160, 84, 30]] },
];

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let setIndex = 0;
let faceW = 0, note = '', noteUntil = 0, faceSeen = 0, faceDet = null, faceState = 'off', faceLast = 0, near = 1, nearGoal = 1, tapsSet = [], blurNow = 0, gone = 0;
const meanC = [0.3, 0.3, 0.3];
let slowNow = { warm: 0, depth: 1, light: 0 };
let GW = 0, GH = 0, grids = [];
let ramp = null, own = 0, lay = null, sArr = null, oArr = null, eArr = null, eTmp = null, tapsE = [];      // shown now (fade toward the chosen set)
let W = 0, H = 0, idx = [];
let camC, camX, bC, bX, bW = 0, bH = 0, bIdx = [], bA, bB, taps = [], outC, outX, midC, midX, grainC;
let acc, img, vig;
let videoEl = null, camState = 'starting';
let lo = 0.2, hi = 0.8, showDebug = false, hintUntil = 7000;

// on-site setup, kept in this browser
function loadCalib() {
  try {
    const c = JSON.parse(localStorage.getItem('rothkoMirror.calib') || 'null');
    if (c && c.nearFace > 0 && c.farFace > 0) { SET.nearFace = c.nearFace; SET.farFace = c.farFace; }
  } catch (e) { /* no storage: use SET */ }
}

function saveCalib() {
  try { localStorage.setItem('rothkoMirror.calib', JSON.stringify({ nearFace: SET.nearFace, farFace: SET.farFace })); } catch (e) { /* not saved */ }
}

function say(t) { note = t; noteUntil = millis() + 3500; }

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noiseDetail(2, 0.5);
  ramp = SETS[setIndex].ramp.map((c) => c.slice());
  own = SETS[setIndex].own;
  lay = { ground: SETS[setIndex].ground.slice(), edge: SETS[setIndex].edge.slice(),
    veils: SETS[setIndex].veils.map((c) => c.slice()) };
  loadCalib();
  makeGrain();
  build();
  startCamera();
}

function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camState = 'no camera'; return; }
  navigator.mediaDevices.getUserMedia({ audio: false,
    video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } } })
    .then((stream) => {
      videoEl = document.createElement('video');
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      videoEl.srcObject = stream;
      videoEl.play();
      camState = 'on';
      if (SET.depth) startFaces();
    })
    .catch(() => { camState = 'no camera'; });
}

// tiny working image, sized to the screen's shape, plus the blur image (half size)
function build() {
  W = SET.cols;
  H = Math.max(8, Math.round(W * height / width));
  idx = Array.from({ length: W * H }, (_, i) => i);
  camC = makeCanvas(W, H); camX = camC.getContext('2d', { willReadFrequently: true });
  // the steam: a true Gaussian blur on a half-size copy (smooth, no squares)
  bW = Math.round(W / 2); bH = Math.max(4, Math.round(H / 2));
  bC = makeCanvas(bW, bH); bX = bC.getContext('2d', { willReadFrequently: true });
  bIdx = Array.from({ length: bW * bH }, (_, i) => i);
  bA = new Float32Array(bW * bH * 3); bB = new Float32Array(bW * bH * 3);
  const sigma = [0, 0.8, 1.5, 2.5, 4][Math.max(0, Math.min(4, Math.round(SET.blur)))];
  taps = makeTaps(sigma);
  // for depth: 16 blur steps from near to far
  tapsSet = Array.from({ length: 16 }, (_, n) => makeTaps(SET.nearBlur + (SET.farBlur - SET.nearBlur) * n / 15));
  outC = makeCanvas(W, H); outX = outC.getContext('2d');
  midC = makeCanvas(W * 4, H * 4); midX = midC.getContext('2d');
  img = outX.createImageData(W, H);
  acc = new Float32Array(W * H * 3).fill(0.3);
  vig = new Float32Array(W * H);
  sArr = new Float32Array(W * H); oArr = new Float32Array(W * H * 3);
  eArr = new Float32Array(W * H); eTmp = new Float32Array(W * H);
  // coarse grids for the slow layer patterns (cheap: shown smoothly stretched)
  GW = 32; GH = Math.max(4, Math.round(GW * H / W));
  grids = Array.from({ length: 3 + SET.veils }, () => new Float32Array((GW + 1) * (GH + 1)));
  // the edge colour is spread wide, so it glows instead of drawing a line
  const se = 4, re = Math.ceil(se * 2.5);
  const we = Array.from({ length: 2 * re + 1 }, (_, t) => Math.exp(-((t - re) * (t - re)) / (2 * se * se)));
  const sumE = we.reduce((a, b) => a + b, 0);
  tapsE = we.map((w, t) => ({ o: t - re, w: w / sumE }));
  idx.forEach((i) => {
    const dx = ((i % W) + 0.5) / W - 0.5, dy = (((i / W) | 0) + 0.5) / H - 0.5;
    vig[i] = Math.max(0, 1 - SET.vignette * (dx * dx + dy * dy) * 1.6);
  });
}

function makeTaps(sigma) {
  const rad = Math.max(1, Math.ceil(sigma * 2.5));
  const ws = Array.from({ length: 2 * rad + 1 }, (_, t) => Math.exp(-((t - rad) * (t - rad)) / (2 * sigma * sigma + 1e-6)));
  const sum = ws.reduce((a, b) => a + b, 0);
  return ws.map((w, t) => ({ o: t - rad, w: w / sum }));
}

// the face detector, on the CPU
async function startFaces() {
  faceState = 'loading';
  try {
    const vision = await import(MP + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
    faceDet = await vision.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' }, runningMode: 'VIDEO' });
    faceState = 'on';
  } catch (e) { faceState = 'failed'; }   // then the blur stays as usual
}

// how near are you? 1 near .. 0 far (or no face): picks the blur, and how far you have dissolved
function readDistance(dt) {
  if (faceDet && millis() - faceLast >= 100) {
    faceLast = millis();
    try {
      const res = faceDet.detectForVideo(videoEl, performance.now());
      let fw = 0;
      (res.detections || []).forEach((d) => { fw = Math.max(fw, d.boundingBox.width / videoEl.videoWidth); });
      // a face lost for a moment (turning, far away) keeps its distance for a second
      if (fw > 0) { faceSeen = millis(); faceW = fw; nearGoal = soften(SET.farFace, SET.nearFace, fw); }
      else if (millis() - faceSeen > SET.holdFace * 1000) { nearGoal = 0; faceW = 0; }
    } catch (e) { faceState = 'failed'; faceDet = null; }
  }
  if (faceState !== 'on') { near = 1; gone = 0; return; }
  near += (nearGoal - near) * (1 - Math.exp(-dt / Math.max(0.05, SET.depthEase)));
  // first the blur grows (near 1 -> 0.35), then you melt into one colour (0.35 -> 0)
  const b = soften(0.35, 1, near), lv = Math.round((1 - b) * 15);
  taps = tapsSet[lv];
  blurNow = SET.nearBlur + (SET.farBlur - SET.nearBlur) * lv / 15;
  gone = 1 - soften(0, 0.4, near);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// fine film grain to hide banding when the tiny image is shown big
function makeGrain() {
  grainC = makeCanvas(256, 256);
  const gx = grainC.getContext('2d');
  const gi = gx.createImageData(256, 256);
  Array.from({ length: 256 * 256 }, (_, i) => i).forEach((i) => {
    const v = 128 + (Math.random() - 0.5) * 90;
    gi.data[i * 4] = v; gi.data[i * 4 + 1] = v; gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255;
  });
  gx.putImageData(gi, 0, 0);
}

function draw() {
  const dt = Math.min(0.1, deltaTime / 1000);
  fadeColours(dt);
  readCamera(dt);
  paint(millis() / 1000);
  show();
  overlay();
}

// fade the shown colours toward the chosen set
function fadeColours(dt) {
  const goal = SETS[setIndex], k = 1 - Math.exp(-dt / 0.8);
  ramp.forEach((c, n) => [0, 1, 2].forEach((j) => { c[j] += (goal.ramp[n][j] - c[j]) * k; }));
  own += (goal.own - own) * k;
  ['ground', 'edge'].forEach((n) => [0, 1, 2].forEach((j) => { lay[n][j] += (goal[n][j] - lay[n][j]) * k; }));
  lay.veils.forEach((c, n) => [0, 1, 2].forEach((j) => { c[j] += (goal.veils[n % goal.veils.length][j] - c[j]) * k; }));
}

function softDraw(ctx) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

function readCamera(dt) {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;
  const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
  // cover the screen's shape, mirrored like a mirror
  const s = Math.max(bW / vw, bH / vh), sw = bW / s, sh = bH / s;
  bX.save();
  softDraw(bX);
  bX.translate(bW, 0); bX.scale(-1, 1);
  bX.drawImage(videoEl, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, bW, bH);
  bX.restore();
  if (SET.depth) readDistance(dt);
  // the steam: Gaussian blur, across then down
  const bd = bX.getImageData(0, 0, bW, bH);
  const px = bd.data;
  bIdx.forEach((i) => { bA[i * 3] = px[i * 4]; bA[i * 3 + 1] = px[i * 4 + 1]; bA[i * 3 + 2] = px[i * 4 + 2]; });
  gauss(bA, bB, 1, bW);
  gauss(bB, bA, bW, bH);
  bIdx.forEach((i) => { px[i * 4] = bA[i * 3]; px[i * 4 + 1] = bA[i * 3 + 1]; px[i * 4 + 2] = bA[i * 3 + 2]; });
  bX.putImageData(bd, 0, 0);
  softDraw(camX);
  camX.drawImage(bC, 0, 0, W, H);
  const d = camX.getImageData(0, 0, W, H).data;
  // the steam follows you slowly
  const k = 1 - Math.exp(-dt / Math.max(0.01, SET.lag));
  idx.forEach((i) => {
    const j = i * 3, o = i * 4;
    acc[j] += (d[o] / 255 - acc[j]) * k;
    acc[j + 1] += (d[o + 1] / 255 - acc[j + 1]) * k;
    acc[j + 2] += (d[o + 2] / 255 - acc[j + 2]) * k;
  });
  // light range of the room (5%..95%), so a dark or a bright room both read
  const hist = new Array(32).fill(0);
  idx.forEach((i) => { hist[Math.min(31, (luma(acc, i * 3) * 32) | 0)]++; });
  let n = 0, a = 0, b = 31;
  const total = W * H;
  hist.some((h, q) => { n += h; if (n > total * 0.05) { a = q; return true; } return false; });
  n = 0;
  hist.slice().reverse().some((h, q) => { n += h; if (n > total * 0.05) { b = 31 - q; return true; } return false; });
  const kk = 1 - Math.exp(-dt / 1.5);
  lo += (a / 32 - lo) * kk;
  hi += (Math.max(a + 3, b + 1) / 32 - hi) * kk;
  // the average colour of the picture: far away you melt into it
  meanC[0] = 0; meanC[1] = 0; meanC[2] = 0;
  idx.forEach((i) => { meanC[0] += acc[i * 3]; meanC[1] += acc[i * 3 + 1]; meanC[2] += acc[i * 3 + 2]; });
  meanC[0] /= W * H; meanC[1] /= W * H; meanC[2] /= W * H;
}

// one direction of the blur: dir 1 = across, dir bW = down; n = length of that line
function gauss(src, dst, dir, n) {
  bIdx.forEach((i) => {
    const pos = dir === 1 ? i % bW : (i / bW) | 0;
    let r = 0, g = 0, b = 0;
    taps.forEach((tp) => {
      const q = Math.min(n - 1, Math.max(0, pos + tp.o));
      const k = (i + (q - pos) * dir) * 3;
      r += src[k] * tp.w; g += src[k + 1] * tp.w; b += src[k + 2] * tp.w;
    });
    dst[i * 3] = r; dst[i * 3 + 1] = g; dst[i * 3 + 2] = b;
  });
}

// one direction of the wide soft spread (single value per pixel)
function spread(src, dst, dir, n) {
  idx.forEach((i) => {
    const pos = dir === 1 ? i % W : (i / W) | 0;
    let v = 0;
    tapsE.forEach((tp) => {
      const q = Math.min(n - 1, Math.max(0, pos + tp.o));
      v += src[i + (q - pos) * dir] * tp.w;
    });
    dst[i] = v;
  });
}

// smooth lookup in a coarse grid (u, v from 0 to 1)
function gridAt(gArr, u, v) {
  const fx = u * GW, fy = v * GH, x0 = Math.min(GW - 1, fx | 0), y0 = Math.min(GH - 1, fy | 0);
  let tx = fx - x0, ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const q = y0 * (GW + 1) + x0;
  const a = gArr[q] + (gArr[q + 1] - gArr[q]) * tx;
  const b = gArr[q + GW + 1] + (gArr[q + GW + 2] - gArr[q + GW + 1]) * tx;
  return a + (b - a) * ty;
}

function luma(arr, j) { return arr[j] * 0.3 + arr[j + 1] * 0.59 + arr[j + 2] * 0.11; }

function soften(e0, e1, v) {
  const q = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return q * q * (3 - 2 * q);
}

// 0..1 -> colour on the four-step ramp, written into out[]
function rampAt(s, out) {
  const f = Math.min(2.999, Math.max(0, s * 3)), n = f | 0, q = f - n;
  const c0 = ramp[n], c1 = ramp[n + 1];
  out[0] = c0[0] + (c1[0] - c0[0]) * q;
  out[1] = c0[1] + (c1[1] - c0[1]) * q;
  out[2] = c0[2] + (c1[2] - c0[2]) * q;
}

function paint(tt) {
  const px = img.data, hasCam = camState === 'on' && videoEl;
  const range = Math.max(0.05, hi - lo), fz = tt * 0.04, rc = [0, 0, 0];
  const dz = tt * 0.02 * SET.drift, L1 = SET.layers;
  // the slow change over minutes: warmth (-1 cool .. 1 warm), veil depth, lightness
  const ct = tt / (Math.max(0.5, SET.cycle) * 60), sc0 = SET.slowChange;
  const tWarm = (noise(ct, 101) - 0.5) * 2.6 * sc0;
  const tDepth = 1 + (noise(ct * 0.8, 202) - 0.5) * 1.6 * sc0;
  const tLight = (noise(ct * 1.2, 303) - 0.5) * 0.16 * sc0;
  const st = SETS[setIndex], tintNow = [0, 1, 2].map((c) => 1 + ((tWarm > 0 ? st.warm[c] : st.cool[c]) - 1) * Math.min(1, Math.abs(tWarm)));
  slowNow = { warm: tWarm, depth: tDepth, light: tLight };
  // pass 1: your light (s) and your own colours for every pixel
  idx.forEach((i) => {
    const j = i * 3;
    if (hasCam) {
      const ar = acc[j] + (meanC[0] - acc[j]) * gone;
      const ag = acc[j + 1] + (meanC[1] - acc[j + 1]) * gone;
      const ab = acc[j + 2] + (meanC[2] - acc[j + 2]) * gone;
      const L = ar * 0.3 + ag * 0.59 + ab * 0.11;
      sArr[i] = Math.min(1, Math.max(0, (L - lo) / range));
      oArr[j] = (L + (ar - L) * SET.sat - lo) / range * 235;
      oArr[j + 1] = (L + (ag - L) * SET.sat - lo) / range * 235;
      oArr[j + 2] = (L + (ab - L) * SET.sat - lo) / range * 235;
    } else {
      const u = ((i % W) + 0.5) / W, v = (((i / W) | 0) + 0.5) / H;
      sArr[i] = 0.45 + (noise(u * 2, v * 2, tt * 0.2) - 0.5) * 0.8;
      rampAt(sArr[i], rc);
      oArr[j] = rc[0]; oArr[j + 1] = rc[1]; oArr[j + 2] = rc[2];
    }
  });
  // pass 1b: where light meets dark, spread out softly
  if (SET.layers > 0) {
    idx.forEach((i) => {
      const x = i % W, y = (i / W) | 0, s0 = sArr[i];
      const xl = x > 0 ? sArr[i - 1] : s0, xr = x < W - 1 ? sArr[i + 1] : s0;
      const yu = y > 0 ? sArr[i - W] : s0, yd = y < H - 1 ? sArr[i + W] : s0;
      eArr[i] = Math.abs(xr - xl) + Math.abs(yd - yu);
    });
    spread(eArr, eTmp, 1, W);
    spread(eTmp, eArr, W, H);
  }
  // the slow patterns of every layer, on the coarse grids
  if (SET.layers > 0) {
    grids.forEach((gArr, n) => {
      // each layer its own scale, direction and speed
      const sc = 1.1 + (n % 4) * 0.35, sp = (n % 2 ? -1 : 1) * (0.6 + n * 0.17);
      Array.from(gArr, (_, q) => q).forEach((q) => {
        const gx = q % (GW + 1), gy = (q / (GW + 1)) | 0;
        gArr[q] = noise(gx / GW * sc + n * 7.1, gy / GH * sc * (n % 3 ? 1.3 : 0.8), 11 + n * 13 + dz * sp);
      });
    });
  }
  // pass 2: paint it in layers
  idx.forEach((i) => {
    const x = i % W, y = (i / W) | 0, u = (x + 0.5) / W, v = (y + 0.5) / H, j = i * 3;
    const s = Math.min(1, Math.max(0, sArr[i] + tLight));
    let r, g, b;
    rampAt(s, rc);
    // the field: your light on the colour ramp, a little of your own colour
    const fr = rc[0] + (oArr[j] - rc[0]) * own;
    const fg = rc[1] + (oArr[j + 1] - rc[1]) * own;
    const fb = rc[2] + (oArr[j + 2] - rc[2]) * own;
    if (L1 > 0) {
      // 1. the stain ground under everything
      r = lay.ground[0]; g = lay.ground[1]; b = lay.ground[2];
      // 2. the field, thin enough that the ground shows through here and there
      const a1 = 1 - L1 * Math.min(0.85, (0.1 + 0.4 * soften(0.45, 0.75, gridAt(grids[0], u, v))) * tDepth);
      r += (fr - r) * a1; g += (fg - g) * a1; b += (fb - b) * a1;
      // 3. thin veils of other tones, each drifting at its own speed:
      //    odd veils sit in your light, even ones in the shadows
      const nv = Math.min(SET.veils, lay.veils.length);
      lay.veils.forEach((vc, n) => {
        if (n >= nv) return;
        const wgt = n % 2 ? 1 - s : s;
        const a2 = L1 * SET.veilOpacity * tDepth * soften(0.35, 0.8, gridAt(grids[3 + n], u, v)) * (0.3 + 0.7 * wgt);
        const lt = 0.6 + 0.5 * s;
        r += (vc[0] * lt - r) * a2; g += (vc[1] * lt - g) * a2; b += (vc[2] * lt - b) * a2;
      });
      // 4. a thin line of colour where light meets dark (feathered edges)
      const edgeK = soften(0.01, 0.07, eArr[i]);
      const a3 = L1 * 0.28 * edgeK * (0.5 + 0.5 * gridAt(grids[1], u, v));
      r += (lay.edge[0] - r) * a3; g += (lay.edge[1] - g) * a3; b += (lay.edge[2] - b) * a3;
      // 5. the final glaze: glossy patches deeper and richer, matte patches paler
      const gl = (gridAt(grids[2], u, v) - 0.5) * 2 * L1;
      if (gl > 0) {
        const m0 = (r + g + b) / 3, k = 1 + gl * 0.35;
        r = (m0 + (r - m0) * k) * (1 - gl * 0.12); g = (m0 + (g - m0) * k) * (1 - gl * 0.12); b = (m0 + (b - m0) * k) * (1 - gl * 0.12);
      } else {
        const k = -gl * 0.12, hz = lay.veils[0];
        r += (hz[0] * 0.9 - r) * k; g += (hz[1] * 0.9 - g) * k; b += (hz[2] * 0.9 - b) * k;
      }
    } else { r = fr; g = fg; b = fb; }
    // optional faint Rothko rectangles: a lighter field above, a darker one below
    if (SET.fields > 0) {
      const side = soften(0.04, 0.14, Math.min(u, 1 - u));
      const top = soften(0.04, 0.12, v) * soften(0.04, 0.12, 0.5 - v);
      const bot = soften(0.04, 0.12, v - 0.54) * soften(0.04, 0.12, 0.96 - v);
      const m = 1 + SET.fields * side * (top * 0.18 - bot * 0.14);
      r *= m; g *= m; b *= m;
    }
    // steam: a pale haze drifting in slow patches
    if (SET.steam > 0) {
      const fog = SET.steam * noise(u * 2.2, v * 1.6 - fz, fz);
      const hz = ramp[2];
      r += (hz[0] - r) * fog; g += (hz[1] - g) * fog; b += (hz[2] - b) * fog;
    }
    // the slow change of warmth
    r *= tintNow[0]; g *= tintNow[1]; b *= tintNow[2];
    const vv = vig[i], o = i * 4;
    // highlights: softly held below the peak, keeping their colour (no burn to white)
    r *= vv; g *= vv; b *= vv;
    const m = Math.max(r, g, b), knee = SET.peak * 0.75;
    if (m > knee) {
      const room = SET.peak - knee, over = m - knee;
      const sc = (knee + room * over / (over + room)) / m;
      r *= sc; g *= sc; b *= sc;
    }
    // shadows: held at the set's deepest colour, never black
    if (SET.floor > 0) {
      const f0 = ramp[0], fl = SET.floor;
      r = Math.max(r, f0[0] * fl); g = Math.max(g, f0[1] * fl); b = Math.max(b, f0[2] * fl);
    }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  });
  outX.putImageData(img, 0, 0);
}

// tiny image -> 4x -> full screen, both steps smoothed (smoother than one big jump)
function show() {
  softDraw(midX);
  if ('filter' in midX) midX.filter = 'blur(3px)';
  midX.drawImage(outC, -6, -6, midC.width + 12, midC.height + 12);
  if ('filter' in midX) midX.filter = 'none';
  const ctx = drawingContext;
  ctx.save();
  softDraw(ctx);
  ctx.drawImage(midC, 0, 0, width, height);
  // grain, moving a little like film
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.3;
  const ox = (frameCount * 37) % 256, oy = (frameCount * 91) % 256;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(grainC, 'repeat');
  ctx.fillRect(0, 0, width + 256, height + 256);
  ctx.restore();
}

function overlay() {
  const ms = millis();
  if (ms < hintUntil || camState !== 'on') {
    const a = camState !== 'on' ? 160 : 160 * Math.min(1, (hintUntil - ms) / 1500);
    noStroke(); fill(255, a); textAlign(CENTER, BOTTOM); textSize(13);
    const msg = camState === 'starting' ? 'allow the camera to see yourself'
      : camState === 'no camera' ? 'no camera: the steam is moving on its own'
      : width < 600 ? SETS[setIndex].name + '   ·   tap: colours'
      : SETS[setIndex].name + '   ·   tap or R: colours   ·   F fullscreen   ·   S still';
    text(msg, width / 2, height - 18);
  }
  if (ms < noteUntil) {
    noStroke(); fill(255, 200); textAlign(CENTER, CENTER); textSize(16);
    text(note, width / 2, height / 2);
  }
  if (showDebug) {
    if (videoEl) drawingContext.drawImage(camC, 10, 10, W * 2, H * 2);
    noStroke(); fill(255); textAlign(LEFT, TOP); textSize(12);
    text(Math.round(frameRate()) + ' fps · ' + W + 'x' + H + ' · blur ' + SET.blur + ' · light ' +
      lo.toFixed(2) + '–' + hi.toFixed(2) + ' · face ' + faceState + ' ' + faceW.toFixed(3) + ' (near ' + SET.nearFace.toFixed(3) + ' gone ' + SET.farFace.toFixed(3) + ') near ' + near.toFixed(2) + ' blur ' + blurNow.toFixed(1) + ' gone ' + gone.toFixed(2) + ' · slow: warm ' + slowNow.warm.toFixed(2) + ' depth ' + slowNow.depth.toFixed(2) + ' light ' + slowNow.light.toFixed(2) + ' · ' + SETS[setIndex].name, 10, 16 + H * 2);
  }
}

function nextColours() {
  setIndex = (setIndex + 1) % SETS.length;
  hintUntil = millis() + 2500;
}

function mousePressed() { nextColours(); return false; }

function keyPressed() {
  const k = String(key).toLowerCase();
  if (k === 'r') nextColours();
  else if (k === 'f') fullscreen(!fullscreen());
  else if (k === 's') saveCanvas('rothko-mirror_' + Date.now(), 'png');
  else if (k === 'd') showDebug = !showDebug;
  else if (k === 'h') hintUntil = 0;
  else if (k === 'n' || k === 'g') {
    if (faceState !== 'on') { say('the face detector is not ready'); return; }
    if (faceW <= 0) { say('no face seen: look at the camera and try again'); return; }
    if (k === 'n') {
      SET.nearFace = faceW;
      if (SET.farFace >= SET.nearFace) SET.farFace = SET.nearFace * 0.5;
      say('near set here (' + faceW.toFixed(3) + ')');
    } else {
      if (faceW >= SET.nearFace) { say('stand further back than the near spot, then press G'); return; }
      SET.farFace = faceW;
      say('gone set here (' + faceW.toFixed(3) + ')');
    }
    saveCalib();
  } else if (k === 'x') {
    try { localStorage.removeItem('rothkoMirror.calib'); } catch (e) { /* nothing */ }
    say('setup forgotten: reload to use the numbers in SET');
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  build();
}
