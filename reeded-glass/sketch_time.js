// Reeded Glass · TIME · Interactive Walls #03 · ORE.XYZ (MAKE #10, 2026-11-08)
// Interaction: every rib is a different moment. Each rib shows you a little
// later than its neighbour (0 to maxDelay seconds). Stand still and you are
// whole; move and your body staggers across the glass like an echo.
//
// Base (shared by all three tests):
// You, seen through a pane of fluted (reeded) glass: a pale, quiet surface,
// and behind it a warm figure broken into vertical ribs, smeared up and down,
// never sharp.
//
// How it works: the camera is read at a small size. The empty room becomes
// pale paper; whatever is not the room (you) becomes ink, darker where you are
// darker. The ink is smeared vertically (the long streaks of the glass), then
// cut into vertical ribs: each rib shows a narrow slice of the image, flipped
// and squeezed, the way each cylinder of real reeded glass bends what is
// behind it. A soft light gradient across every rib gives the glass its body.
//
// The room: press B with nobody in view and it learns the empty room (3 s).
// Until then it guesses from light and dark only (dark things = ink), which is
// muddier. The room image stays in memory only, never saved or sent.
//
// Runs in p5.js 1.x and 2.x (p5 web editor OK). Nothing is recorded.
// Keys: B learn empty room · X forget room · R next colours · [ ] fewer/more
// ribs · F fullscreen · S save a still · D debug · H hide hint
// T delay shape (sweep / from the centre / scattered) · - = shorter / longer delay
// Click / tap: next colours.

const SET = {
  render: 0.6,     // draw the glass at this part of the screen size, then stretch it (1 = sharpest, slowest)
  finder: true,    // find the person with a small body model (no B needed). false = learn the empty room with B
  finderEvery: 150, // ms between looks (more = lighter on the laptop, a little slower to follow)
  finderSoft: 3,   // how soft the person's edge is (working pixels; the smear and ribs soften it more)
  maxDelay: 2,     // seconds: the latest rib shows you this long ago
  delayShape: 0,   // 0 sweep left to right, 1 now in the centre and later to the edges, 2 scattered
  cols: 200,       // width of the small working image
  ribs: 34,        // glass ribs across the screen
  ribJitter: 0.18, // ribs a little uneven in width (0 = perfectly even)
  bend: -1.3,      // each rib: minus = image flipped (like real glass), size = how much it squeezes
  smear: 0.05,     // vertical streaks, part of the screen height (0 = none)
  softX: 1,        // slight sideways softness inside each rib (0 or 1)
  lag: 0.25,       // seconds the glass takes to follow you
  ribLight: 0.35,  // light and shade across each rib (0 = flat glass)
  ribLine: 0.25,   // thin bright line where two ribs meet (0 = none)
  hairlines: 0.12, // fine streaks inside the glass (0 = none)
  presence: [0.07, 0.22], // how different from the room a pixel must be to start / fully become ink
  tone: 0.45,      // how much your own light and dark shows inside the ink (0 = one flat colour)
  roomDrift: 0.003,// how fast the learned room follows slow light changes (0 = never)
};

// colour sets: ramp = paper -> light ink -> ink -> deepest ink. own = how much of
// your real colours shows (1 = only yours, on the paper).
const SETS = [
  { name: 'rust', own: 0, ramp: [[238, 236, 231], [226, 160, 118], [190, 76, 32], [72, 22, 12]] },
  { name: 'your colours', own: 1, ramp: [[238, 236, 231], [200, 196, 190], [120, 116, 110], [40, 38, 36]] },
  { name: 'indigo', own: 0, ramp: [[236, 236, 234], [158, 172, 204], [44, 66, 140], [16, 20, 52]] },
];

let setIndex = 0, lut = null, own = 0;
let W = 0, H = 0, idx = [], colIdx = [], rowIdx = [];
let camC, camX, outC, outX, midC, midX, img, glassC;
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
let segmenter = null, segState = 'off', segBusy = false, segLast = 0, person = null, personB = null;
let inkS, colS, buf, bufB, room = null, roomState = 'none', roomFrames = 0, roomAcc = null, roomAt = 0;
let ribsX = [], ribDelay = [], ring = [], ringX = [], ringT = null, ringHead = 0, ringIdx = [];
const RING = 150;   // stored moments (about 2.5 s at 60 fps, 5 s at 30 fps)
const SHAPES = ['sweep', 'from the centre', 'scattered'];
let videoEl = null, camState = 'starting', facing = 'user', downAt = 0, tapTimer = null, lastTap = 0;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let showDebug = false, hintUntil = 8000, note = '', noteUntil = 0, lastMs = 0, gainNow = 1;

function say(t) { note = t; noteUntil = millis() + 3500; }

function setup() {
  createCanvas(Math.round(windowWidth * SET.render), Math.round(windowHeight * SET.render));
  pixelDensity(1);
  fitCanvas();   // after pixelDensity, which resets the canvas size
  document.body.style.touchAction = 'none';   // phone: no scrolling or zooming on taps
  useSet(setIndex);
  build();
  startCamera();
}

function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camState = 'no camera'; return; }
  if (videoEl && videoEl.srcObject) videoEl.srcObject.getTracks().forEach((tr) => tr.stop());
  camState = 'starting';
  navigator.mediaDevices.getUserMedia({ audio: false,
    video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } })
    .then((stream) => {
      videoEl = document.createElement('video');
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      videoEl.srcObject = stream;
      videoEl.play();
      camState = 'on';
      if (SET.finder && segState === 'off') startFinder();
    })
    .catch(() => { camState = 'no camera'; });
}

// the small canvas is stretched to fill the window
function fitCanvas() {
  const el = drawingContext.canvas;
  el.style.width = windowWidth + 'px'; el.style.height = windowHeight + 'px';
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// colour ramp as a 256-step table
function useSet(n) {
  const s = SETS[n];
  own = s.own;
  lut = new Uint8ClampedArray(256 * 3);
  Array.from({ length: 256 }, (_, i) => i).forEach((i) => {
    const t = i / 255 * 3, k = Math.min(2, Math.floor(t)), f = t - k;
    const a = s.ramp[k], b = s.ramp[k + 1];
    lut[i * 3] = a[0] + (b[0] - a[0]) * f;
    lut[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    lut[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  });
}

function build() {
  W = SET.cols;
  H = Math.max(8, Math.round(W * height / width));
  idx = Array.from({ length: W * H }, (_, i) => i);
  colIdx = Array.from({ length: W }, (_, i) => i);
  rowIdx = Array.from({ length: H }, (_, i) => i);
  camC = makeCanvas(W, H); camX = camC.getContext('2d', { willReadFrequently: true });
  outC = makeCanvas(W, H); outX = outC.getContext('2d');
  midC = makeCanvas(W * 4, H * 4); midX = midC.getContext('2d');
  img = outX.createImageData(W, H);
  inkS = new Float32Array(W * H);
  person = new Float32Array(W * H); personB = new Float32Array(W * H);
  colS = new Float32Array(W * H * 3).fill(0.5);
  buf = new Float32Array(W * H * 4); bufB = new Float32Array(W * H * 4);
  room = null; roomState = roomState === 'learning' ? 'learning' : 'none';
  ring = Array.from({ length: RING }, () => makeCanvas(W, H));
  ringX = ring.map((c) => c.getContext('2d'));
  ringT = new Float64Array(RING).fill(-1e9); ringHead = 0;
  ringIdx = Array.from({ length: RING }, (_, i) => i);
  buildRibs();
}

// how late each rib is, 0..1 of maxDelay
function buildDelays() {
  const n = ribsX.length;
  ribDelay = ribsX.map((_, j) => {
    if (SET.delayShape === 1) return Math.abs(j - (n - 1) / 2) / ((n - 1) / 2);
    if (SET.delayShape === 2) return noise(j * 1.7, 41.2);
    return j / Math.max(1, n - 1);
  });
}

// rib edges across the screen (a little uneven) and the glass light, drawn once
function buildRibs() {
  // ribs count for a wide screen; a phone held upright gets fewer, so they stay wide enough
  const n = Math.max(6, Math.round(SET.ribs * Math.min(1, windowWidth / 1000)));
  const ws = Array.from({ length: n }, (_, i) => 1 + SET.ribJitter * (noise(i * 0.9, 7.3) * 2 - 1));
  const sum = ws.reduce((a, b) => a + b, 0);
  let x = 0;
  ribsX = ws.map((w) => { const a = x; x += w / sum * width; return [a, x]; });
  buildDelays();
  glassC = makeCanvas(width, 4);
  const g = glassC.getContext('2d');
  ribsX.forEach(([a, b]) => {
    const gr = g.createLinearGradient(a, 0, b, 0);
    const L = SET.ribLight;
    // light falls from the left: bright edge, soft body, darker right side
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.5 * L) + ')');
    gr.addColorStop(0.25, 'rgba(255,255,255,' + (0.15 * L) + ')');
    gr.addColorStop(0.6, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,' + (0.45 * L) + ')');
    g.fillStyle = gr;
    g.fillRect(a, 0, b - a + 0.5, 4);
    if (SET.ribLine > 0) {
      g.fillStyle = 'rgba(255,255,255,' + SET.ribLine + ')';
      g.fillRect(Math.round(a), 0, 1, 4);
    }
    // a few fine streaks inside each rib, light or dark, never the same twice
    Array.from({ length: 5 }, (_, j) => j).forEach((j) => {
      const v = noise(a * 0.05 + j * 3.1, 1.7), xx = a + (b - a) * ((j + 0.5) / 5 + (v - 0.5) * 0.15);
      g.fillStyle = (v > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (SET.hairlines * Math.abs(v - 0.5) * 2) + ')';
      g.fillRect(xx, 0, 1, 4);
    });
  });
}

function soften(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// learn the empty room: average a few frames, after a 3 s countdown
// the person finder: MediaPipe selfie segmenter (Apache 2.0), on this device's CPU,
// about 10 times a second. Loaded once from the internet, then cached by the browser.
async function startFinder() {
  segState = 'loading';
  try {
    const vision = await import(MP + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
    segmenter = await vision.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: SEG_MODEL, delegate: 'CPU' },
      runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
    segState = 'on';
    say('ready: the glass finds you by itself');
    onReady();
  } catch (e) {
    segState = 'failed';   // then use B (learn the empty room) as before
    say('body finder could not load: press B with nobody in view');
  }
}

// where are you? -> person[] (0..1) at the working size, same crop and mirror as the picture
function findPerson() {
  if (!segmenter || segBusy || millis() - segLast < SET.finderEvery) return;
  segLast = millis(); segBusy = true;
  try {
    segmenter.segmentForVideo(videoEl, performance.now(), (res) => {
      const masks = res && res.confidenceMasks;
      if (!masks || !masks.length) return;
      const mk = masks[masks.length - 1], md = mk.getAsFloat32Array(), mw = mk.width, mh = mk.height;
      const sc = Math.max(W / mw, H / mh), ox = (mw - W / sc) / 2, oy = (mh - H / sc) / 2;
      const flip = facing === 'user';
      idx.forEach((i) => {
        const x = i % W, y = (i / W) | 0, fx = ox + (x + 0.5) / sc;
        const mx = Math.min(mw - 1, Math.max(0, Math.round(flip ? mw - 1 - fx : fx)));
        const my = Math.min(mh - 1, Math.max(0, Math.round(oy + (y + 0.5) / sc)));
        personB[i] = soften(0.25, 0.75, md[my * mw + mx]);
      });
      // soft edge: a small blur across and down, so it never reads as a cut-out
      const R = Math.max(0, Math.round(SET.finderSoft));
      if (R > 0) {
        idx.forEach((i) => {
          const x = i % W, row = i - x;
          let v = 0;
          ring1(R).forEach((t) => { v += personB[row + Math.max(0, Math.min(W - 1, x + t))]; });
          person[i] = v / (2 * R + 1);
        });
        personB.set(person);
        idx.forEach((i) => {
          const x = i % W, y = (i / W) | 0;
          let v = 0;
          ring1(R).forEach((t) => { v += personB[Math.max(0, Math.min(H - 1, y + t)) * W + x]; });
          person[i] = v / (2 * R + 1);
        });
      } else person.set(personB);
    });
  } catch (e) { segState = 'failed'; segmenter = null; }
  segBusy = false;
}

const ringCache = {};
function ring1(R) { return ringCache[R] || (ringCache[R] = Array.from({ length: 2 * R + 1 }, (_, t) => t - R)); }

// when the glass starts knowing who is "you": forget what came before
function onReady() {
  if (typeof ringT !== 'undefined' && ringT) ringT.fill(-1e9);   // TIME: forget the muddy moments
  if (typeof stain !== 'undefined' && stain) stain.fill(0);       // STAIN: clean glass
  if (typeof calmUntil !== 'undefined') calmUntil = millis() + 1500;   // TURN: the switch is not movement
}

function finding() { return segState === 'on'; }

function learnRoom() {
  if (finding()) { say('not needed: the glass finds you by itself (finder: false in SET to use B)'); return; }
  if (camState !== 'on') { say('no camera yet'); return; }
  roomState = 'learning'; roomFrames = 0; roomAcc = new Float32Array(W * H * 3); roomAt = millis() + 3000;
  say(isTouch ? 'put the phone down and step out: learning the room in 3 s' : 'step out of view: learning the empty room in 3 s');
}

function draw() {
  const now = millis(), dt = Math.min(0.1, (now - (lastMs || now)) / 1000); lastMs = now;
  background(lut[0], lut[1], lut[2]);
  if (camState !== 'on' || !videoEl || videoEl.readyState < 2) { hint(); return; }

  // camera, mirrored, cropped to fill the screen's shape
  const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
  const sc = Math.max(W / vw, H / vh), dw = vw * sc, dh = vh * sc;
  camX.save(); if (facing === 'user') { camX.translate(W, 0); camX.scale(-1, 1); }   // mirror only the selfie camera
  camX.drawImage(videoEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
  camX.restore();
  const d = camX.getImageData(0, 0, W, H).data;
  if (finding()) findPerson();

  if (roomState === 'learning' && now > roomAt) {
    idx.forEach((i) => { roomAcc[i * 3] += d[i * 4]; roomAcc[i * 3 + 1] += d[i * 4 + 1]; roomAcc[i * 3 + 2] += d[i * 4 + 2]; });
    roomFrames++;
    if (roomFrames >= 20) {
      room = roomAcc.map((v) => v / roomFrames);
      roomState = 'on'; say('room learned'); onReady();
    }
  }

  // 1. ink: how much of you is at each pixel, and your colour
  const k = 1 - Math.exp(-dt / Math.max(0.02, SET.lag));
  const pa = SET.presence[0], pb = SET.presence[1], tone = SET.tone, drift = SET.roomDrift;
  if (room) {
    // the camera changes its exposure when someone comes in: follow it
    let sF = 0, sR = 0;
    idx.forEach((i) => { sF += d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]; sR += room[i * 3] + room[i * 3 + 1] + room[i * 3 + 2]; });
    gainNow += ((sR > 0 ? sF / sR : 1) - gainNow) * 0.2;
  }
  idx.forEach((i) => {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    let goal;
    if (finding()) {
      goal = person[i] * (1 - tone + tone * (1 - lum) * 1.4);
    } else if (room) {
      const rr = room[i * 3] * gainNow, rg = room[i * 3 + 1] * gainNow, rb = room[i * 3 + 2] * gainNow;
      const diff = (Math.abs(r - rr) + Math.abs(g - rg) + Math.abs(b - rb)) / 765;
      const p = soften(pa, pb, diff);
      goal = p * (1 - tone + tone * (1 - lum) * 1.4);
      // where nothing is happening, the room slowly follows the light
      if (p < 0.05 && drift > 0) {
        room[i * 3] += (r / gainNow - room[i * 3]) * drift;
        room[i * 3 + 1] += (g / gainNow - room[i * 3 + 1]) * drift;
        room[i * 3 + 2] += (b / gainNow - room[i * 3 + 2]) * drift;
      }
    } else {
      goal = soften(0.75, 0.12, lum);   // no room learned: dark = ink
    }
    inkS[i] += (Math.min(1, goal) - inkS[i]) * k;
    colS[i * 3] += (r / 255 - colS[i * 3]) * k;
    colS[i * 3 + 1] += (g / 255 - colS[i * 3 + 1]) * k;
    colS[i * 3 + 2] += (b / 255 - colS[i * 3 + 2]) * k;
    buf[i * 4] = inkS[i]; buf[i * 4 + 1] = colS[i * 3]; buf[i * 4 + 2] = colS[i * 3 + 1]; buf[i * 4 + 3] = colS[i * 3 + 2];
  });

  // 2. vertical streaks: two box blurs down each column (soft, no steps)
  const R = Math.round(SET.smear * H);
  if (R > 0) { smearY(buf, bufB, R); smearY(bufB, buf, R); }
  if (SET.softX > 0) { smearX(buf, bufB, 1); buf.set(bufB); }

  // 3. colour: paper -> ink ramp, or your own colours on the paper
  const px = img.data;
  idx.forEach((i) => {
    const t = Math.max(0, Math.min(1, buf[i * 4]));
    const li = (t * 255) | 0;
    let r = lut[li * 3], g = lut[li * 3 + 1], b = lut[li * 3 + 2];
    if (own > 0) {
      // your colours, a little richer, laid on the paper as thick as the ink
      const cr = buf[i * 4 + 1], cg = buf[i * 4 + 2], cb = buf[i * 4 + 3], m = (cr + cg + cb) / 3;
      const yr = (m + (cr - m) * 1.4) * 255, yg = (m + (cg - m) * 1.4) * 255, yb = (m + (cb - m) * 1.4) * 255;
      const a = Math.min(1, t * 1.6) * own;
      r = lut[0] + (yr - lut[0]) * a; g = lut[1] + (yg - lut[1]) * a; b = lut[2] + (yb - lut[2]) * a;
    }
    // the paper is a little greyer at the top, like light falling on a pane
    const y = ((i / W) | 0) / H, shadeTop = 1 - 0.05 * (1 - y);
    px[i * 4] = r * shadeTop; px[i * 4 + 1] = g * shadeTop; px[i * 4 + 2] = b * shadeTop; px[i * 4 + 3] = 255;
  });
  outX.putImageData(img, 0, 0);
  midX.imageSmoothingEnabled = true; midX.imageSmoothingQuality = 'high';
  // keep this moment
  ringX[ringHead].drawImage(outC, 0, 0); ringT[ringHead] = now; ringHead = (ringHead + 1) % RING;

  // 4. the glass: each rib shows a slice of the image, flipped and squeezed
  const ctx = drawingContext, sx = midC.width / width, bend = SET.bend;
  ctx.imageSmoothingEnabled = true;
  const rx = W / width;
  ribsX.forEach(([a, b], j) => {
    const w = b - a, c = (a + b) / 2, sw = Math.abs(w * bend);
    // the stored moment closest to (now - this rib's delay)
    const want = now - ribDelay[j] * SET.maxDelay * 1000;
    // the newest stored moment that is not newer than wanted (or the oldest we have)
    const oldest = ringIdx.reduce((m, q) => (ringT[q] > -1e8 && ringT[q] < ringT[m]) ? q : m, (ringHead + RING - 1) % RING);
    const best = ringIdx.reduce((m, q) => (ringT[q] <= want + 8 && ringT[q] > ringT[m]) ? q : m, oldest);
    const src = ring[best];
    const s0 = Math.max(0, Math.min(W - sw * rx, (c - sw / 2) * rx));
    ctx.save();
    ctx.beginPath(); ctx.rect(a, 0, w + 0.5, height); ctx.clip();
    if (bend < 0) { ctx.translate(a + b, 0); ctx.scale(-1, 1); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, s0, 0, sw * rx, H, a, 0, w + 0.5, height);
    ctx.restore();
  });
  // light and shade of each rib, soft over the paper, stronger over you
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.drawImage(glassC, 0, 0, width, height);
  ctx.restore();

  hint();
  if (showDebug) debugInfo();
}

// box blur down each column, radius R, with edge clamping
function smearY(src, dst, R) {
  const n = 2 * R + 1, W4 = W * 4;
  colIdx.forEach((x) => {
    const x4 = x * 4;
    // start: the column's first value repeated above the top
    let s0 = src[x4] * (R + 1), s1 = src[x4 + 1] * (R + 1), s2 = src[x4 + 2] * (R + 1), s3 = src[x4 + 3] * (R + 1);
    rowIdx.forEach((y) => {
      if (y < 1 || y > R) return;
      const o = Math.min(H - 1, y) * W4 + x4;
      s0 += src[o]; s1 += src[o + 1]; s2 += src[o + 2]; s3 += src[o + 3];
    });
    rowIdx.forEach((y) => {
      const o = y * W4 + x4;
      dst[o] = s0 / n; dst[o + 1] = s1 / n; dst[o + 2] = s2 / n; dst[o + 3] = s3 / n;
      const add = Math.min(H - 1, y + R + 1) * W4 + x4, sub = Math.max(0, y - R) * W4 + x4;
      s0 += src[add] - src[sub]; s1 += src[add + 1] - src[sub + 1];
      s2 += src[add + 2] - src[sub + 2]; s3 += src[add + 3] - src[sub + 3];
    });
  });
}

function smearX(src, dst, R) {
  // three taps (R = 1) written out: no inner loop, fast in the p5 editor too
  idx.forEach((i) => {
    const x = i % W, o = i * 4, l = x > 0 ? o - 4 : o, r = x < W - 1 ? o + 4 : o;
    dst[o] = (src[l] + src[o] + src[r]) / 3; dst[o + 1] = (src[l + 1] + src[o + 1] + src[r + 1]) / 3;
    dst[o + 2] = (src[l + 2] + src[o + 2] + src[r + 2]) / 3; dst[o + 3] = (src[l + 3] + src[o + 3] + src[r + 3]) / 3;
  });
}

function hint() {
  push(); scale(SET.render);
  const now = millis();
  noStroke(); textFont('sans-serif'); textSize(13); textAlign(LEFT, BOTTOM);
  if (camState !== 'on') {
    fill(90); text(camState === 'starting' ? 'waiting for the camera…' : 'no camera: allow the camera and reload', 16, height / SET.render - 16);
    pop(); return;
  }
  if (now < noteUntil) { fill(70, 70, 70, 200); text(note, 16, height / SET.render - 16); pop(); return; }
  if (now < hintUntil) {
    fill(70, 70, 70, 170);
    if (isTouch) {
      textSize(12);
      text(room || finding() ? 'tap = colours · double tap = other camera' : 'hold 1 s with nobody in view = learn the empty room', 16, height / SET.render - 34);
      text(room || finding() ? 'hold 1 s = learn the empty room again' : 'tap = colours · double tap = other camera', 16, height / SET.render - 16);
      pop(); return;
    }
    const first = room || finding() ? '' : 'B with nobody in view = learn the empty room   ';
    text(first + 'T delay shape  - = delay  R colours  [ ] ribs  F fullscreen  H hide', 16, height / SET.render - 16);
  }
  pop();
}

function debugInfo() {
  push(); scale(SET.render);
  fill(0, 150); rect(10, 10, 300, 74);
  fill(255); textSize(12); textAlign(LEFT, TOP);
  text('fps ' + frameRate().toFixed(0) + '  work ' + W + 'x' + H + '  ribs ' + ribsX.length, 18, 18);
  text('finder ' + segState + '  room ' + (room ? 'learned' : roomState) + '  exposure x' + gainNow.toFixed(2), 18, 36);
  text('colours ' + SETS[setIndex].name + '  delay ' + SET.maxDelay + ' s ' + SHAPES[SET.delayShape], 18, 54);
  pop();
}

function nextColours() {
  setIndex = (setIndex + 1) % SETS.length;
  useSet(setIndex);
  say(SETS[setIndex].name);
}

// mouse and touch (phone): tap = next colours · double tap = other camera ·
// hold 1 s = learn the empty room (3 s countdown: put the phone down, step out)
// no 'return false' here: in the p5 web editor that would stop the click from
// giving the preview the keyboard, and then no key works
function mousePressed() { downAt = millis(); window.focus(); }

function mouseReleased() {
  const now = millis();
  if (now - downAt > 700) { learnRoom(); return; }
  if (now - lastTap < 350) {
    clearTimeout(tapTimer); lastTap = 0;
    facing = facing === 'user' ? 'environment' : 'user';
    room = null; roomState = 'none';
    say(facing === 'user' ? 'front camera' : 'back camera');
    startCamera();
    return;
  }
  lastTap = now;
  tapTimer = setTimeout(nextColours, 350);
}

// keys by their place on the keyboard, so they work with a Greek (or any) layout too
let lastCode = '';
window.addEventListener('keydown', (e) => { lastCode = e.code || ''; }, true);
const CODES = { BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', NumpadSubtract: '-', NumpadAdd: '=' };

function keyPressed() {
  const k = lastCode.indexOf('Key') === 0 ? lastCode.slice(3).toLowerCase() : (CODES[lastCode] || String(key).toLowerCase());
  if (k === 'b') learnRoom();
  else if (k === 'x') { room = null; roomState = 'none'; say('room forgotten: dark = ink'); }
  else if (k === 'r') nextColours();
  else if (k === '[' || k === ']') {
    SET.ribs = Math.max(4, Math.min(80, SET.ribs + (k === ']' ? 2 : -2)));
    buildRibs(); say(SET.ribs + ' ribs');
  }
  else if (k === 'f') fullscreen(!fullscreen());
  else if (k === 's') saveCanvas('reeded-glass_' + Date.now(), 'png');
  else if (k === 'd') showDebug = !showDebug;
  else if (k === 't') { SET.delayShape = (SET.delayShape + 1) % 3; buildDelays(); say('delay: ' + SHAPES[SET.delayShape]); }
  else if (k === '-' || k === '=') { SET.maxDelay = Math.max(0.25, Math.min(6, SET.maxDelay + (k === '=' ? 0.5 : -0.5))); say('delay ' + SET.maxDelay + ' s'); }
  else if (k === 'h') { hintUntil = 0; noteUntil = 0; }
}

function windowResized() {
  resizeCanvas(Math.round(windowWidth * SET.render), Math.round(windowHeight * SET.render));
  fitCanvas();
  const keep = room;
  build();
  if (keep && keep.length === W * H * 3) room = keep;
}
