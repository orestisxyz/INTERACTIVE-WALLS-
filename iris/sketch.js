// Iris grid — ORE.XYZ MAKE #07b. A grid of generative eyes, each in its own natural colour,
// all turning to look at the centre of your face (webcam + MediaPipe BlazeFace, runs locally).
// Part of Interactive Walls (github.com/orestisxyz/INTERACTIVE-WALLS-).
// How it works:
// - An iris "structure" is painted once into an unwrapped strip (x = angle, y = pupil edge -> limbus)
//   in neutral grey: fibres, crypts, collarette, furrows. Its brightness becomes a relief map (normals).
// - Each eye takes one of the structures, rotated by a random angle, and recolours it with its own
//   natural palette, bred from the 5 measured from the reference photos; the most different of
//   many candidates are kept, so every eye is a different colour.
// - The screen decides how many eyes: cells of about EYE_SIZE px fill it (a phone gets a few big eyes,
//   a large monitor many); resizing the window adds or removes eyes.
// - Gaze: your face is treated as a point in front of the screen (closer face = nearer point), and
//   every eyeball rotates toward it, so the eyes converge on you. With several people, each eye picks one.
// - Each eye has its own blink rhythm and lid shape, eyelids that follow its gaze and blink,
//   a pupil that narrows when you come close or the room is bright, and veins in the white.
// - BLINK_BACK: a heavier face model also reads your eyelids, and the eyes watching you blink back.
// Performance (§16.8): all heavy loops use forEach (p5 editor loop protection); each eye's image is
// re-rendered only every few frames (round robin) while the turning is a cheap affine transform drawn
// every frame; buffers shrink if fps falls. Works with p5.js 1.x and 2.x.
// Behaviour, kept simple so every reaction has a clear cause:
// - you are there: the scattered eyes gather around you and follow you as you move, and every eye looks at you (with several people, each eye picks one; a newcomer gets a look from all)
// - you come closer: the pupils narrow
// - you leave: they look at each other and drift, then fall asleep one by one (one stirs now and then)
// - you arrive: they wake in a wave, nearest first
// - a loud sound: they snap toward it and flinch away (sudden movement too, if motion=1)
// - it breathes (a low sound, starts after the first click or tap): closer and warmer as they gather round you,
//   held almost still while they stare, back to a slow sleeping breath when you leave
// Keys: F fullscreen (hides the cursor), S save a still, R new colours, V start/stop a video recording,
//   D show what the camera sees (faces found, zoom area).
// URL settings (for exhibiting, all optional): ?seed=123&eyes=20&most=120&minsize=100&size=260&max=30&dist=0.45&sleep=20&around=1&turn=45&tilt=25
//   &space=1.7&sound=1&motion=0&blink=0&parallel=0.8&gain=1.6&layout=scatter&ripple=0.15&breath=1&quiet=1

// Palettes measured from the five reference photos (colour values only; no image data is used).
// ramp = median colour in 8 rings from pupil edge (0) to limbus (7); fibre = brightest 15% of the mid-iris.
const PALETTES = [
  { ramp: [[69, 48, 41], [132, 101, 77], [157, 140, 108], [146, 142, 127], [122, 124, 115], [90, 86, 76], [34, 27, 21], [42, 21, 17]], fibre: [171, 179, 179] },
  { ramp: [[148, 64, 11], [191, 85, 11], [202, 91, 11], [209, 98, 12], [217, 112, 24], [207, 120, 40], [190, 111, 46], [157, 86, 38]], fibre: [244, 155, 50] },
  { ramp: [[63, 72, 70], [85, 90, 85], [92, 106, 99], [85, 100, 99], [63, 83, 91], [79, 88, 95], [74, 74, 78], [55, 53, 55]], fibre: [119, 147, 156] },
  { ramp: [[109, 91, 71], [183, 164, 132], [201, 187, 150], [191, 183, 148], [176, 169, 141], [153, 144, 117], [146, 132, 113], [157, 142, 118]], fibre: [227, 225, 210] },
  { ramp: [[59, 63, 62], [102, 117, 115], [113, 126, 123], [116, 131, 126], [99, 118, 119], [77, 96, 104], [59, 73, 84], [32, 38, 43]], fibre: [146, 166, 168] },
];
const Q = new URLSearchParams(location.search), opt = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
const EYE_SIZE = opt('size', 260);   // wanted size of one eye's cell in px: the screen size decides how many eyes fit
const MAX_EYES = opt('max', 30);     // grid layout: upper limit for very big screens (each eye costs drawing time)
const MOST_EYES = opt('most', 120);  // scattered: as many eyes as the device can draw smoothly, up to this many
const MIN_CELL = opt('minsize', 100);   // ...and while each eye still gets at least this much room (px)
const FIXED_EYES = Q.has('eyes') ? Math.max(1, parseInt(Q.get('eyes'))) : 0;   // eyes=20: exactly this many, no adapting
const SPACE = opt('space', 1.7);     // room around each eye: 1 = packed, 1.7 = about 9 eyes on a laptop, so the ring around you reads clearly
let EYES = 0, cols = 1, rows = 1, minEyes = 5, ceilEyes = 1e9, cellT = 100;   // set from the screen in layout()
const STRUCTS = 2;              // distinct fibre structures shared (rotated) between the eyes
const A = 512, R = 128;         // structure texture: angle samples x radial samples
const SX = A / 1024;            // stroke sizes were designed at A = 1024
const IRIS_IN_CELL = 0.36;      // iris diameter as a fraction of a grid cell (eyeball is 2x)
const MAX_BUF = 220, MIN_BUF = 90;
const BG = [5, 6, 8];
const PUPIL = [4, 5, 7];
const COLL_S = 0.3;             // collarette position (fraction of iris width from pupil)
const DEPTH = 3;                // relief strength (0 = flat)
const LIGHT_PERIOD = 40;        // seconds for the light to circle once
const MAX_TURN = 38;            // degrees an eye can rotate
const FACE_DIST = opt('dist', 0.45);       // virtual distance of your face from the screen, in screen widths (smaller = eyes turn more)
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const DELEGATE = opt('gpu', 0) > 0 ? 'GPU' : 'CPU';   // face search on the CPU (safe; phones always try the GPU first) or set gpu=1 to try the GPU
const BLINK_BACK = opt('blink', 0) > 0;   // 1 = face-landmark model, about 4x heavier: the eyes blink back when you blink (try with DELEGATE = 'GPU')
const LMODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_FACES = 3;            // people the eyes can share their attention between
const HOLD_MS = 3000;           // keep following someone this long after the camera loses them (turned head, blur)
const LAYOUT = Q.get('layout') || 'scatter';   // 'scatter' = loose crowd of different sizes, 'grid' = even rows
const RIPPLE = opt('ripple', 0.15);       // seconds for a turn to travel across the screen from the side nearest you (0 = all at once)
const WAKE_SPREAD = 1.6;        // seconds for the waking wave to cross the screen, nearest eyes first
const BREATH = opt('breath', 1) > 0;    // a low breathing sound (starts after the first click, tap or key)
const QUIET = opt('quiet', 1) > 0;      // with nobody there they look at each other, answer with a blink, and one sometimes stirs in its sleep
const AROUND = opt('around', 1) > 0;   // someone there: each eye finds its own spot in loose rings around them (0 = they stay scattered)
const TURN = opt('turn', 45) * Math.PI / 180;   // each whole eye turns in depth toward you, like a head turning (degrees, 0 = flat)
const TILT = opt('tilt', 25) * Math.PI / 180;    // and spins it flat on the screen so its long axis points at you (degrees, 0 = level)
const AROUND_HOLE = 0.85;               // the first ring's distance from your face, in cells (your face stays clear)
const VIGNETTE = 0.85;          // how dark the edges get (0 = none): the eyes come out of the dark
const PARALLEL = opt('parallel', 0.8);   // 0 = each eye converges on you; 1 = all turn the same way (reads most clearly as "they follow me")
const PHONE = matchMedia('(pointer: coarse)').matches;   // touch screen: a phone or tablet, usually handheld and close
const GAIN = opt('gain', PHONE ? 1 : 1.6);   // how far the eyes turn for a step you take sideways (1 = true to the camera's view)
// small differences between eyes: gaze speed (kept close, so they all clearly follow), lid openness,
// seconds between blinks, blink length
const TYPES = {
  wide: { speed: 0.45, lid: 1.08, blink: [3, 7], dur: 0.2 },
  steady: { speed: 0.38, lid: 1, blink: [2.5, 6], dur: 0.22 },
  sleepy: { speed: 0.32, lid: 0.82, blink: [4, 9], dur: 0.34 },
  blinky: { speed: 0.4, lid: 0.92, blink: [1.5, 4], dur: 0.2 },
};
const VEINS = 1;                // redness of the whites (0 = none)
const SLEEP_AFTER = opt('sleep', 20);    // seconds with nobody there before the eyes start falling asleep
const STARTLE_SOUND = opt('sound', 1) > 0;   // loud sounds startle the eyes (asks for the microphone)
const STARTLE_MOTION = opt('motion', 0) > 0;   // 1 = sudden movement startles them too (off by default: people walking past set it off)
const SOUND_LEVEL = 5;          // how much louder than the room a sound must be to startle (x average level)
const MOTION_LEVEL = 28;        // how big a sudden change in the camera image must be (0-255)

const structs = [];             // { ratio, GR, GA, NZ } per structure
const eyes = [];
let N, irisPx, AI, D, SHADE, inside;   // shared per-pixel lookup tables for the eye buffers
const COS = new Float32Array(A), SIN = new Float32Array(A), CS0 = new Float32Array(A), CZ = new Float32Array(A);
const LR = new Float32Array(A), LA = new Float32Array(A), HR = new Float32Array(A), HA = new Float32Array(A);
let fpsAvg = 60, lastAdapt = 0, startMs, rr = 0, cell = 100;
let cam, small, tiny, detector, lastDetect = 0, seenAt = 0, idleNext = 0, light = 0.35, seed;
let stirNext = 0, newcomer = null, prevLum = null, mic = null, recorder = null, recDot = null, shock = 0;
const startle = { at: -1e9, x: 0, y: 0 };
const focus = { x: 0, y: 0, z: 1 }, focusT = { x: 0, y: 0, z: 1 };   // where the eyes look with nobody there (screen px, z in px)
let faces = [];                 // people in view, sorted left to right: { x, y, z, tx, ty, tz, close, shut }

let jobs = [];
const range = (n) => Int32Array.from({ length: n }, (_, i) => i);
const repeat = (n, chunk, body) => {
  range(ceil(n / chunk)).forEach((c) => jobs.push(() => range(min(chunk, n - c * chunk)).forEach((k) => body(c * chunk + k))));
};
const sstep = (a, b, x) => { const t = constrain((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixC = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const lumOf = (c) => c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
const nWrap = (x, k, z) => { const a = x / A * TWO_PI; return noise(100 + cos(a) * k, 100 + sin(a) * k, z); };

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));   // sharp on phone and retina screens (the iris buffers follow it)
  seed = Q.has('seed') ? parseInt(Q.get('seed')) : floor(random(1e6));
  randomSeed(seed); noiseSeed(seed);
  console.log('iris seed', seed);
  const t0 = millis();
  range(A).forEach((a) => { COS[a] = cos(a / A * TWO_PI); SIN[a] = sin(a / A * TWO_PI); });
  buildStructure(0);
  jobs.forEach((job) => job()); jobs = [];   // first structure before the first frame
  layout();                                   // how many eyes fit this screen, and where they go
  console.log(EYES + ' eyes (' + cols + ' x ' + rows + '):', eyes.map((e) => e.type).join(' '));
  focus.x = focusT.x = width / 2; focus.y = focusT.y = height / 2; focus.z = focusT.z = width * FACE_DIST;
  startTracking();
  if (STARTLE_SOUND) startMic();
  range(STRUCTS - 1).forEach((k) => buildStructure(k + 1));   // the rest build in the background, one job per frame
  startMs = millis();
  console.log('first frame ready in', round(millis() - t0), 'ms');
}

// ---------- structure (neutral grey iris, built once) ----------

function buildStructure(k) {
  const g = createGraphics(A, R);
  g.pixelDensity(1);
  const st = {};
  const grey = (v) => [v, v, v];
  noiseSeed(1000 + k * 77);

  // A. base field: grey with broad patches and radial streaks (half resolution, scaled up)
  const AH = A / 2, RH = R / 2, gs = createGraphics(AH, RH);
  gs.pixelDensity(1);
  jobs.push(() => { gs.loadPixels(); range(A).forEach((x) => { CS0[x] = nWrap(x, 4, 7); CZ[x] = nWrap(x, 9, 3); }); });
  repeat(RH, 16, (y) => {
    const s = (y + 0.5) / RH;
    range(AH).forEach((xh) => {
      const x = xh * 2;
      const n = nWrap(x, 3, s * 2), sa = nWrap(x, 30, s * 1.5), sb = nWrap(x, 70, s * 0.8);
      const v = 128 * (0.92 + 0.4 * (n - 0.5) + 0.6 * (sa - 0.5) + 0.4 * (sb - 0.5));
      const i = 4 * (y * AH + xh);
      gs.pixels[i] = gs.pixels[i + 1] = gs.pixels[i + 2] = v; gs.pixels[i + 3] = 255;
    });
  });
  jobs.push(() => { gs.updatePixels(); g.image(gs, 0, 0, A, R); gs.remove(); g.noFill(); });

  const wrapped = (fn, x0 = -1) => {   // draw at x, x-A, x+A so the seam disappears
    for (const dx of [-A, 0, A]) {
      if (x0 >= 0 && ((dx < 0 && x0 < A - 80 * SX) || (dx > 0 && x0 > 80 * SX))) continue;
      g.push(); g.translate(dx, 0); fn(); g.pop();
    }
  };
  const sw = (w) => g.strokeWeight(max(0.5, w * SX * 1.4));

  // B. pupillary-zone fibres
  repeat(floor(1300 * SX), 100, () => {
    const x0 = random(A), s1 = COLL_S + random(-0.03, 0.06);
    const c = grey(random() < 0.3 ? 50 : random(130, 200));
    g.stroke(c[0], c[1], c[2], random(40, 110)); sw(random(0.6, 1.4));
    const ph = random(TWO_PI), amp = random(1, 4) * SX;
    wrapped(() => { g.beginShape();
      for (let k2 = 0; k2 <= 8; k2++) { const s = lerp(0.03, s1, k2 / 8); g.vertex(x0 + amp * sin(s * 40 + ph), s * R); }
      g.endShape(); }, x0);
  });
  // C. ciliary-zone fibres
  repeat(floor(2600 * SX), 100, () => {
    const x0 = random(A), s0 = COLL_S + random(-0.02, 0.08), s1 = random(0.6, 0.98);
    const c = grey(random() < 0.25 ? random(40, 90) : 128 + 110 * sq(random(0.2, 1)));
    g.stroke(c[0], c[1], c[2], random(18, 75)); sw(random(0.5, 1.5));
    const ph = random(TWO_PI), amp = random(0.6, 2.5) * SX, fr = random(50, 110), wander = random(-10, 10) * SX;
    wrapped(() => { g.beginShape();
      for (let k2 = 0; k2 <= 22; k2++) { const t = k2 / 22, s = lerp(s0, s1, t); g.vertex(x0 + amp * sin(s * fr + ph) + wander * (noise(x0 * 0.01, t * 2) - 0.5) * 2, s * R); }
      g.endShape(); }, x0);
  });
  // E. crypts
  repeat(floor(random(24, 42)), 50, (i) => {
    const near = random() < 0.75;
    const x0 = random(A), sc = near ? COLL_S + random(0.06, 0.26) : random(0.6, 0.85);
    const w = random(3, near ? 13 : 6) * SX, h = random(10, near ? 42 : 16) * R / 256;
    const pts = [];
    for (let k2 = 0; k2 < 28; k2++) { const a = k2 / 28 * TWO_PI, r = 0.75 + 0.5 * noise(i, k2 * 0.2); pts.push([x0 + cos(a) * w * r, sc * R + sin(a) * h * r]); }
    wrapped(() => {
      g.noStroke(); g.fill(30, 30, 30, random(70, 150));
      g.beginShape(); for (const p of pts) g.vertex(p[0], p[1]); g.endShape(CLOSE);
      g.noFill(); g.stroke(225, 225, 225, random(50, 120)); sw(random(0.8, 1.8));
      g.beginShape(); for (const p of pts) g.vertex(p[0], p[1]); g.endShape(CLOSE);
    }, x0);
  });
  // D. trabeculae
  repeat(140, 70, () => {
    const x0 = random(A), s0 = COLL_S + random(0, 0.05), s1 = random(0.55, 0.95);
    g.stroke(230, 230, 230, random(50, 120)); sw(random(1.5, 3.2));
    const ph = random(TWO_PI), amp = random(2, 6) * SX, lean = random(-18, 18) * SX;
    wrapped(() => { g.beginShape();
      for (let k2 = 0; k2 <= 16; k2++) { const t = k2 / 16, s = lerp(s0, s1, t); g.vertex(x0 + amp * sin(s * 30 + ph) + lean * t * t, s * R); }
      g.endShape(); }, x0);
  });
  jobs.push(() => {
    // F. collarette
    for (let pass = 0; pass < 3; pass++) {
      const v = [180, 200, 235][pass];
      g.stroke(v, v, v, [60, 100, 170][pass]); sw([10, 5, 1.8][pass]);
      g.beginShape();
      for (let x = -4; x <= A + 4; x += 2) {
        const zig = (CZ[(x + A) % A] - 0.5) * 0.1 + (nWrap(x, 40, pass) - 0.5) * 0.03;
        g.vertex(x, (COLL_S + (CS0[(x + A) % A] - 0.5) * 0.12 + zig) * R);
      }
      g.endShape();
    }
    // G. furrows
    for (let i = 0; i < 5; i++) {
      const s = random(0.68, 0.9), x0 = random(A), len = random(0.08, 0.3) * A;
      wrapped(() => {
        for (const [v, off, al] of [[30, 0, 60], [220, 2, 30]]) {
          g.stroke(v, v, v, al); sw(2);
          g.beginShape();
          for (let x = x0; x < x0 + len; x += 4) g.vertex(x, s * R + off + (noise(x * 0.04, i) - 0.5) * 5);
          g.endShape();
        }
      });
    }
    // I. pupillary ruff
    for (let y = 0; y < 5; y++) { g.stroke(25, 25, 25, 230 - y * 44); g.line(0, y, A, y); }
    g.noStroke(); g.fill(60, 60, 60, 160);
    for (let x = 0; x < A; x += random(2, 3)) g.ellipse(x, random(1, 3), random(1, 2), random(2, 3));
    g.loadPixels();
    st.pix = new Uint8ClampedArray(g.pixels);
    g.remove();
    st.ratio = new Float32Array(A * R); st.GR = new Float32Array(A * R); st.GA = new Float32Array(A * R); st.NZ = new Float32Array(A * R);
    st.hgt = new Float32Array(A * R);
  });
  // brightness relative to its ring (1 = average): this is what each eye's palette multiplies
  repeat(R, 16, (y) => {
    let sum = 0;
    range(A).forEach((x) => { sum += st.pix[4 * (y * A + x)]; });
    const m = max(1, sum / A), s = y / R;
    range(A).forEach((x) => {
      const v = st.pix[4 * (y * A + x)];
      st.ratio[y * A + x] = v / m;
      const cs = COLL_S + (CS0[x] - 0.5) * 0.12 + (CZ[x] - 0.5) * 0.1;
      st.hgt[y * A + x] = 0.7 * v / 255 + 0.35 * exp(-sq(s / 0.035)) + 0.45 * exp(-sq((s - cs) / 0.07)) - 0.5 * s - 0.4 * sstep(0.85, 1, s);
    });
  });
  repeat(R, 16, (y) => {
    const yu = max(0, y - 2), yd = min(R - 1, y + 2);
    range(A).forEach((x) => {
      const i = y * A + x, H = st.hgt;
      const gr = DEPTH * (H[yd * A + x] - H[yu * A + x]) / (yd - yu) * 2;
      const ga = DEPTH * (H[y * A + (x + 1) % A] - H[y * A + (x + A - 1) % A]) / 2;
      const nl = 1 / sqrt(gr * gr + ga * ga + 1);
      st.GR[i] = -gr * nl; st.GA[i] = -ga * nl; st.NZ[i] = nl;
    });
  });
  jobs.push(() => {
    st.pix = null; st.hgt = null;
    structs[k] = st;
    eyes.forEach((e) => { if (e.want === k) { e.st = k; colourise(e); } });   // eyes waiting for this one switch over
  });
}

// ---------- eyes ----------

// natural variations bred from the measured palettes: blend two references ring by ring (blue-grey x amber
// gives hazels and greens), sometimes give the inner rings a third one (central heterochromia, as in the
// references), then nudge hue a little, keep saturation in a natural range and vary darkness (browns).
const rgb2hsv = (c) => {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx > 0 ? d / mx : 0, mx];
};
const hsv2rgb = (h, s, v) => {
  h = ((h % 360) + 360) % 360 / 60; const c = v * s, x = c * (1 - abs(h % 2 - 1)), m = v - c;
  const r = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][floor(h) % 6];
  return [(r[0] + m) * 255, (r[1] + m) * 255, (r[2] + m) * 255];
};
const MAX_SAT = 0.72;           // natural ceiling (the most saturated reference ring is ~0.94)

function naturalPalette() {
  const a = random(PALETTES), b = random(PALETTES), c = random(PALETTES);
  const t = random(), ti = random() < 0.45 ? random(0.4, 0.9) : 0;
  const dh = random(-14, 14), sk = random(0.6, 1.1), vk = random() < 0.3 ? random(0.45, 0.7) : random(0.8, 1.15);
  const ramp = a.ramp.map((ca, k) => {
    let col = mixC(ca, b.ramp[k], t);
    col = mixC(col, c.ramp[k], ti * (1 - sstep(1.5, 3.5, k)));    // inner rings only
    const [h, s0, v] = rgb2hsv(col);
    return hsv2rgb(h + dh, min(MAX_SAT, s0 * sk), min(1, v * vk));
  });
  const [fh, fs, fv] = rgb2hsv(mixC(a.fibre, b.fibre, t));
  return { ramp, fibre: hsv2rgb(fh + dh, min(MAX_SAT * 0.8, fs * sk), min(1, fv * lerp(1, vk, 0.5))) };
}

// breed many candidates and keep the most different set (farthest-point picking on the mid-iris colour)
// (also different from the palettes of the eyes already on screen, when eyes are added on a resize)
function naturalPalettes(n, existing = []) {
  const cands = Array.from({ length: 160 + 4 * n }, naturalPalette);
  const key = (p) => { const m = [0, 0, 0]; [1, 2, 3, 4, 5].forEach((k) => { m[0] += p.ramp[k][0]; m[1] += p.ramp[k][1]; m[2] += p.ramp[k][2]; }); return m.map((v) => v / 5); };
  const keys = cands.map(key), dist = (u, v) => sqrt(sq(u[0] - v[0]) + sq(u[1] - v[1]) * 1.3 + sq(u[2] - v[2]));
  const have = existing.map(key), picked = [];
  if (!have.length) { picked.push(floor(random(cands.length))); have.push(keys[picked[0]]); }
  range(n - picked.length).forEach(() => {
    let best = -1, bi = 0;
    cands.forEach((_, i) => { const d = min(...have.map((h) => dist(keys[i], h))); if (d > best) { best = d; bi = i; } });
    picked.push(bi); have.push(keys[bi]);
  });
  return shuffle(picked.map((i) => cands[i]));
}

// how many eyes fit: cells of about EYE_SIZE px filling the screen, at most MAX_EYES
function gridFor(w, h) {
  const s = max(EYE_SIZE, sqrt(w * h / MAX_EYES));
  let c = max(1, round(w / s)), r = max(1, round(h / s));
  range(20).forEach(() => { if (c * r > MAX_EYES) { if (w / c > h / r) r--; else c--; } });
  return [c, r];
}

// add or remove eyes to match the grid; new eyes get new colours and the least common personalities
function setEyeCount(n) {
  eyes.splice(n).forEach((e) => { if (e.buf) e.buf.remove(); if (e.veins) e.veins.remove(); });
  if (eyes.length >= n) return;
  const pals = naturalPalettes(n - eyes.length, eyes.map((e) => e.pal));
  pals.forEach((pal) => {
    const count = (ty) => eyes.filter((e) => e.type === ty).length;
    const type = shuffle(Object.keys(TYPES)).sort((a, b) => count(a) - count(b))[0];
    eyes.push(makeEye(pal, type));
  });
}

function makeEye(pal, type) {
  const want = floor(random(STRUCTS)), ty = TYPES[type];
  return { want, st: structs[want] ? want : 0, pal, off: floor(random(A)), type, ty,
    phase: random(100), breath: random(7, 12), speed: ty.speed * random(0.85, 1.15),
    pick: random(), face: -1,
    blinkAt: random(0.5, 4), blinkStart: -1, close: 0, red: random(0.3, 1),
    sc: random(0.65, 1.25), gath: 0, rot: 0, t3x: 0, t3y: 0, has: false, sx: 0, sy: 0, mvx: 0, mvy: 0, pace: random(1.0, 1.8), qNext: random(3), qEye: null, qx: 0, qy: 0, stirUntil: 0, lx: random(-0.45, 0.45), ly: random(-0.45, 0.45),
    sleep: 0, sleepDelay: random(0, 12), wakeAt: 0, hx: 0, hy: 0, jolt: random(0, 0.15),
    gx: 0, gy: 0, vx: 0, vy: 0, x: 0, y: 0, col: new Uint8ClampedArray(A * R * 3), buf: null, veins: null };
}

// recolour a structure with this eye's palette: ring colour x local brightness, highlights toward the fibre colour
function colourise(e) {
  const ratio = structs[e.st].ratio, ramp = e.pal.ramp, fib = e.pal.fibre, col = e.col;
  range(R).forEach((y) => {
    const sr = min(y / R, 0.999) * 7, k0 = floor(sr), c = mixC(ramp[k0], ramp[k0 + 1], sr - k0);
    range(A).forEach((x) => {
      const src = y * A + (x + e.off) % A, q = ratio[src], j = 3 * (y * A + x);
      const hl = q > 1 ? min(0.7, (q - 1) * 0.6) : 0;
      col[j] = c[0] * q + (fib[0] - c[0] * q) * hl;
      col[j + 1] = c[1] * q + (fib[1] - c[1] * q) * hl;
      col[j + 2] = c[2] * q + (fib[2] - c[2] * q) * hl;
    });
  });
}

// As many eyes as the device can draw: it starts at the count that suits the screen (or the count this
// device managed last time), then adapt() adds eyes while drawing stays smooth and takes some away when it
// doesn't. layout(n) re-places the crowd for n eyes: the eyes already there glide to their new places and
// shrink slowly to the new size, new eyes open where they land. layout() starts afresh (new screen size).
const ADAPT_EYES = LAYOUT !== 'grid' && !FIXED_EYES;
const savedKey = () => 'iris-eyes-' + width + 'x' + height;
const mostEyes = () => FIXED_EYES || max(minEyes, min(MOST_EYES, floor(width * height / (MIN_CELL * MIN_CELL * (PHONE ? 1 : SPACE)))));
function layout(n) {
  [cols, rows] = gridFor(width, height);
  const scatter = LAYOUT !== 'grid', first = !n || !eyes.length, prev = eyes.map((e) => [e.x, e.y]), had = eyes.length;
  if (scatter) {
    minEyes = max(PHONE ? 4 : 5, round(cols * rows / (PHONE ? 1 : SPACE)));   // the screen's own count: same eye size, fewer eyes
    if (first) { let saved = 0; try { saved = parseInt(localStorage.getItem(savedKey())) || 0; } catch (e) { /* no storage */ } n = FIXED_EYES || saved; ceilEyes = 1e9; }
    EYES = FIXED_EYES || constrain(n || minEyes, minEyes, mostEyes());
    if (EYES > minEyes) { const cells = EYES * (PHONE ? 1 : SPACE); cols = max(1, round(sqrt(cells * width / height))); rows = max(1, ceil(cells / cols)); }
  } else EYES = cols * rows;
  setEyeCount(EYES);
  const cellWas = cell;
  cell = cellT = min(width / cols, height / rows);
  eyes.forEach((e, i) => {
    const c = i % cols, r = floor(i / cols);
    e.x = width / 2 + (c - (cols - 1) / 2 + (scatter ? e.lx + (r % 2 ? 0.25 : -0.25) : 0)) * cell;   // rows offset like bricks
    e.y = height / 2 + (r - (rows - 1) / 2 + (scatter ? e.ly : 0)) * cell;
    e.s = scatter ? e.sc : 1;   // size of this eye
  });
  if (scatter) { scatterEyes(first ? 0 : min(had, EYES)); relax(); }   // a change of count: the eyes already there keep their places, new ones fill the gaps
  eyes.forEach((e) => { e.hx = e.x; e.hy = e.y; });   // home: where an eye drifts back to
  drawOrder = eyes.slice().sort((a, b) => a.s - b.s);   // bigger eyes in front
  const n2 = constrain(floor(cell * IRIS_IN_CELL / 0.9 * pixelDensity() * (scatter ? 1.15 : 1)), MIN_BUF, MAX_BUF);
  if (first) {
    makeVignette();
    makeTables(n2);
    eyes.forEach((e) => { if (!e.col.some((v) => v > 0)) colourise(e); });
    return;
  }
  // a change of count: old eyes keep where they are (they glide home), new ones sleep until coloured, then open
  cell = cellWas;
  prev.forEach(([x, y], i) => { if (eyes[i]) { eyes[i].x = x; eyes[i].y = y; } });
  if (abs(n2 - N) > N * 0.15) makeTables(n2);
  eyes.slice(had).forEach((e) => {
    e.sleep = 1; e.wakeAt = 1e12; e.ready = false;
    if (!e.buf) { e.buf = createGraphics(N, N); e.buf.pixelDensity(1); e.buf.loadPixels(); e.buf.pixels.fill(0); }
    jobs.push(() => { colourise(e); renderEye(e, millis() / 1000); e.ready = true; e.wakeAt = millis() + random(100, 900); });
  });
}

// a loose crowd that still covers the screen evenly: each eye takes the best of 60 random spots, the one
// furthest from the eyes already placed (best-candidate sampling; distance measured eye-shaped: wide, not tall)
function scatterEyes(keep) {
  const placed = eyes.slice(0, keep).map((e) => ({ x: e.hx, y: e.hy }));
  eyes.forEach((e, i) => {
    if (i < keep) { e.x = e.hx; e.y = e.hy; return; }
    let best = null, bd = -1;
    range(60).forEach(() => {
      const x = random(0.04, 0.96) * width, y = random(0.06, 0.94) * height;
      let d = 2 * min(x, width - x, (y) * 1.6, (height - y) * 1.6);   // edges count too (at half), so few eyes still spread out
      placed.forEach((o) => { d = min(d, sqrt(sq(x - o.x) + sq((y - o.y) * 1.6))); });
      if (d > bd) { bd = d; best = { x, y }; }
    });
    e.x = best.x; e.y = best.y; placed.push(best);
  });
}

// push overlapping eyes apart (eye-shaped distance: wide, not tall); eyes may sit half off the edge
let drawOrder = [], vig = null;
function relax() {
  const bs = cell * IRIS_IN_CELL / 0.9;
  range(40).forEach(() => {
    eyes.forEach((a, i) => eyes.forEach((b, j) => {
      if (j <= i) return;
      const A = 0.92 * bs * (a.s + b.s), B = 0.6 * bs * (a.s + b.s);
      const dx = b.x - a.x, dy = b.y - a.y, d = sqrt(sq(dx / A) + sq(dy / B));
      if (d >= 1.05 || d === 0) return;
      const push = (1.05 - d) * 0.5, ux = dx / A / d, uy = dy / B / d;
      a.x -= ux * push * A * 0.5; a.y -= uy * push * B * 0.5; b.x += ux * push * A * 0.5; b.y += uy * push * B * 0.5;
    }));
    eyes.forEach((e) => { e.x = constrain(e.x, cell * 0.1, width - cell * 0.1); e.y = constrain(e.y, cell * 0.1, height - cell * 0.1); });
  });
}

// soft darkness: a vignette over everything, so the eyes near the edges sink into the dark. On screen it is a
// page layer (free for the graphics chip); it is painted into the canvas only for saved stills and videos.
let vigDiv = null;
function makeVignette() {
  if (vig) vig.remove();
  vig = null;
  if (VIGNETTE <= 0) return;
  if (!vigDiv) {
    vigDiv = document.createElement('div');
    vigDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5';
    vigDiv.style.background = `radial-gradient(circle farthest-corner at 50% 50%, rgba(${BG},0) 35%, rgba(${BG},${VIGNETTE * 0.45}) 60%, rgba(${BG},${VIGNETTE}) 100%)`;
    document.body.appendChild(vigDiv);
  }
  vig = createGraphics(ceil(width / 4), ceil(height / 4)); vig.pixelDensity(1);
  const c = vig.drawingContext, w = vig.width, hh = vig.height, r = sqrt(w * w + hh * hh) / 2;
  const g = c.createRadialGradient(w / 2, hh / 2, r * 0.35, w / 2, hh / 2, r);
  g.addColorStop(0, `rgba(${BG},0)`); g.addColorStop(0.6, `rgba(${BG},${VIGNETTE * 0.45})`); g.addColorStop(1, `rgba(${BG},${VIGNETTE})`);
  c.fillStyle = g; c.fillRect(0, 0, w, hh);
}

function makeTables(n) {
  N = n;
  irisPx = N * 0.45;
  AI = new Int32Array(N * N); D = new Float32Array(N * N); SHADE = new Float32Array(N * N);
  const ins = [];
  range(N * N).forEach((i) => {
    const x = i % N, y = (i / N) | 0, dx = x - N / 2 + 0.5, dy = y - N / 2 + 0.5;
    const d = sqrt(dx * dx + dy * dy) / irisPx;
    D[i] = d;
    AI[i] = floor((atan2(dy, dx) / TWO_PI + 1) * A) % A;
    SHADE[i] = 1 - 0.22 * sstep(-0.2, -1, dy / irisPx);
    if (d < 1.12) ins.push(i);
  });
  inside = Int32Array.from(ins);
  eyes.forEach((e) => {
    if (e.buf) e.buf.remove();
    e.buf = createGraphics(N, N); e.buf.pixelDensity(1); e.buf.loadPixels();
    e.buf.pixels.fill(0);
    renderEye(e, millis() / 1000);
  });
}

// draw one eye's iris into its buffer (the expensive part, done round robin)
function renderEye(e, t) {
  const st = structs[e.st], col = e.col, px = e.buf.pixels;
  // pupil: slow breathing + small unrest, narrower in a bright room and when its person comes close
  const pr = (0.34 + 0.05 * sin(TWO_PI * (t + e.phase) / e.breath) + 0.03 * (noise(t * 0.35, e.phase) - 0.5) * 2)
    * (1.15 - 0.45 * sstep(0.1, 0.7, light)) * (1 - 0.28 * e.close) * (1 + 0.3 * shock);   // fright widens it
  const aa = 1.5 / irisPx;
  inside.forEach((i) => {
    const d = D[i], ai = AI[i];
    let s = (d - pr) / (1 - pr);
    s = s < 0 ? 0 : s > 0.999 ? 0.999 : s;
    const fy = s * (R - 1), y0 = fy | 0, w = fy - y0;
    const t0 = 3 * (y0 * A + ai), t1 = t0 + 3 * A;
    let r = col[t0] + (col[t1] - col[t0]) * w, g = col[t0 + 1] + (col[t1 + 1] - col[t0 + 1]) * w, b = col[t0 + 2] + (col[t1 + 2] - col[t0 + 2]) * w;
    const ti = y0 * A + (ai + e.off) % A, nr = st.GR[ti], na = st.GA[ti], nz = st.NZ[ti];
    let dif = nr * LR[ai] + na * LA[ai] + nz * 0.8; dif = dif < 0 ? 0 : dif;
    let sp = nr * HR[ai] + na * HA[ai] + nz * HZ; sp = sp < 0 ? 0 : sp; sp *= sp; sp *= sp; sp *= sp; sp *= sp; sp *= sp;
    const lit = 0.35 + 0.75 * dif, spec = 50 * sp;
    r = r * lit + spec; g = g * lit + spec; b = b * lit + spec;
    const pe = (pr - d) / aa;
    if (pe > -1) { const k = pe > 1 ? 1 : (pe + 1) / 2; r += (PUPIL[0] - r) * k; g += (PUPIL[1] - g) * k; b += (PUPIL[2] - b) * k; }
    let al = 255;
    if (d > 0.95) { const k = sstep(0.96, 1.03, d); r *= 1 - 0.45 * k; g *= 1 - 0.45 * k; b *= 1 - 0.45 * k; al = 255 * (1 - sstep(1.0, 1.1, d)); }
    const sh = SHADE[i], p = 4 * i;
    px[p] = r * sh; px[p + 1] = g * sh; px[p + 2] = b * sh; px[p + 3] = al;
  });
  e.buf.updatePixels();
}

// ---------- per frame ----------

let HZ = 0;
function draw() {
  const t0 = performance.now();
  drawFrame();
  drawMs = lerp(drawMs, performance.now() - t0, 0.05);   // how busy drawing keeps the machine
}

function drawFrame() {
  if (jobs.length) jobs.shift()();          // background structure building, one small job per frame
  const t = millis() / 1000;
  // light: low and slowly circling; turned into each angle's local frame once per frame
  const phi = TWO_PI * t / LIGHT_PERIOD - 2.2;
  const lx = 0.6 * cos(phi), ly = 0.6 * sin(phi), lz = 0.8;
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; HZ = hz / hl;
  for (let a = 0; a < A; a++) {
    const c = COS[a], sn = SIN[a];
    LR[a] = lx * c + ly * sn; LA[a] = -lx * sn + ly * c;
    HR[a] = hx * c + hy * sn; HA[a] = -hx * sn + hy * c;
  }
  // re-render a few eyes per frame (pupils breathe slowly, so a few times a second is plenty)
  // 2 iris renders a frame, however many eyes (pupils change slowly); closed, sleeping eyes are skipped
  range(2).forEach(() => { const e = eyes[rr % EYES]; rr++; if (e.sleep < 0.95) renderEye(e, t); });

  track();
  background(BG);
  const bs0 = cell * IRIS_IN_CELL / 0.9;     // on-screen size of an eye buffer (times each eye's size)
  drawingContext.imageSmoothingEnabled = true;
  const dt = min(0.1, deltaTime / 1000), steps = constrain(ceil(dt * 60 - 0.01), 1, 6), h = dt * 60 / steps;
  shock = 1 - sstep(0, 1.6, t - startle.at);   // 1 just after a startle, fading out
  const away = (millis() - seenAt) / 1000;
  creatureMoves(t, dt);
  if (QUIET && t > stirNext) {   // asleep: now and then one of them half wakes, looks around, and goes back to sleep
    const asleep = eyes.filter((e) => e.sleep > 0.9);
    if (asleep.length) random(asleep).stirUntil = t + random(3, 6);
    stirNext = t + random(12, 25);
  }
  drawOrder.forEach((e) => {
    if (e.ready === false) return;   // a new eye still getting its colours
    const bs = bs0 * e.s;
    // nobody there for a while: each eye gets drowsy and closes, one after another; awake again at once
    // (when someone arrives, each eye waits for the waking wave to reach it)
    if (away > SLEEP_AFTER + e.sleepDelay) e.sleep = QUIET && t < e.stirUntil ? max(0, e.sleep - dt * 1.5) : min(1, e.sleep + dt / 5);
    else if (millis() >= e.wakeAt) e.sleep = max(0, e.sleep - dt * 3);
    // each eye rotates toward its own target, at its own speed (saccade-like)
    const g = gazeTarget(e, t, dt);
    // aim from a point between this eye and the screen centre: mostly parallel gaze, a little convergence
    const par = g.own ? 0 : lerp(PARALLEL, 0.4, e.gath);   // on the screen itself: from the eye; gathered round you: they converge a little
    const vx = g.x - lerp(e.x, width / 2, par), vy = g.y - lerp(e.y, height / 2, par), dist = sqrt(vx * vx + vy * vy);
    const tth = min(radians(MAX_TURN), atan2(dist, g.z)), tgx = dist > 0 ? vx / dist * tth : 0, tgy = dist > 0 ? vy / dist * tth * 0.75 : 0;   // eyes turn less up/down than sideways
    const dx = tgx - e.gx, dy = tgy - e.gy, err = sqrt(dx * dx + dy * dy);
    // moving like a real eye, but without steps: a critically damped spring (smooth speed, no overshoot) that is
    // soft while it follows you (pursuit) and much stiffer for a big change of target (a quick saccade)
    let w = err > 0.15 ? min(0.5, 0.2 + e.speed) : 0.08 + e.speed * 0.25;
    if (shock > 0.4) w = 0.5; else if (e.sleep > 0.3) w *= 0.4;
    range(steps).forEach(() => {   // timed in 1/60 s units, so the eyes move at the same speed at any frame rate
      e.vx += h * (w * w * (tgx - e.gx) - 2 * w * e.vx); e.vy += h * (w * w * (tgy - e.gy) - 2 * w * e.vy);
      e.gx += h * e.vx; e.gy += h * e.vy;
    });
    e.close = lerp(e.close, e.face >= 0 && faces[e.face] ? faces[e.face].close : 0, 0.03);
    // tilt: the eye's long axis turns toward the person it watches, so its look along it reads as a stare
    const pf = e.face >= 0 && faces[e.face];
    const head = (1 - e.sleep) * lerp(0.75, 1, e.gath);   // every awake eye turns toward you like a head, gathered ones fully
    let rt = 0;
    if (pf && TILT > 0) { let a = atan2(pf.y - e.y, pf.x - e.x); if (a > HALF_PI) a -= PI; else if (a < -HALF_PI) a += PI; rt = constrain(a, -TILT, TILT) * head; }
    e.rot = lerp(e.rot, rt, min(1, dt * 2.5));
    // turn in depth: the eye turns toward you as if on a ball, so its far side narrows (an affine stand-in for 3D)
    let ux = 0, uy = 0;
    if (pf && TURN > 0) {
      const dx = pf.x - e.x, dy = pf.y - e.y, d = sqrt(dx * dx + dy * dy) || 1, a = min(TURN, atan2(d, cell * 1.2)) * head;
      ux = dx / d * a; uy = dy / d * a;
    }
    e.t3x = lerp(e.t3x, ux, min(1, dt * 2.5)); e.t3y = lerp(e.t3y, uy, min(1, dt * 2.5));
    const turn = sqrt(e.t3x * e.t3x + e.t3y * e.t3y), tdir = atan2(e.t3y, e.t3x);
    const th = sqrt(e.gx * e.gx + e.gy * e.gy), dir = atan2(e.gy, e.gx) - e.rot, lphi = phi - e.rot;   // gaze and light in the eye's own (tilted) frame
    const ri = bs * 0.45, rb = 2 * ri, off = 2 * ri * sin(th);
    const L = lids(e, rb, t);
    const ctx = drawingContext;
    if (L.shut > 0.97) return;                  // closed: nothing left in the dark
    ctx.save(); ctx.translate(e.x, e.y);
    if (turn > 0.01) { ctx.rotate(tdir); ctx.scale(cos(turn), 1); ctx.rotate(-tdir); }
    ctx.rotate(e.rot); ctx.translate(-e.x, -e.y);
    ctx.save();
    lidPath(ctx, e.x, e.y, L); ctx.clip();      // everything of the eye is seen through the lid opening
    sclera(e.x, e.y, rb, lphi);
    if (VEINS > 0) { if (!e.veins) e.veins = makeVeins(e); ctx.globalAlpha = VEINS; ctx.drawImage(e.veins.elt, e.x - rb, e.y - rb, 2 * rb, 2 * rb); ctx.globalAlpha = 1; }
    ctx.save();   // canvas calls, not p5 push/pop: p5 2.x pop() would undo the eye's tilt
    ctx.translate(e.x + off * cos(dir), e.y + off * sin(dir));
    ctx.rotate(dir); ctx.scale(cos(th), 1); ctx.rotate(-dir);
    ctx.drawImage(e.buf.elt, -bs / 2, -bs / 2, bs, bs);
    ctx.restore();
    // soft shading where the lids meet the eyeball: an elliptical gradient that darkens toward the lid edges
    // and into the corners, plus the shadow the upper lid casts downward
    const yu = (L.cu + e.y) / 2, yl = (L.cl + e.y) / 2, ry = max(1, (yl - yu) / 2), ym = (yu + yl) / 2;
    ctx.save();
    ctx.translate(e.x, ym); ctx.scale(1, ry / (rb * 0.98));
    const og = ctx.createRadialGradient(0, 0, 0, 0, 0, rb * 0.98);
    og.addColorStop(0, 'rgba(30,14,12,0)'); og.addColorStop(0.55, 'rgba(30,14,12,0.05)');
    og.addColorStop(0.82, 'rgba(30,14,12,0.35)'); og.addColorStop(1, 'rgba(30,14,12,0.8)');
    ctx.fillStyle = og; ctx.fillRect(-rb, -rb, 2 * rb, 2 * rb);
    ctx.restore();
    const ug = ctx.createLinearGradient(0, yu, 0, yu + rb * 0.32);
    ug.addColorStop(0, 'rgba(20,8,6,0.6)'); ug.addColorStop(1, 'rgba(20,8,6,0)');
    ctx.fillStyle = ug; ctx.fillRect(e.x - rb, yu - rb * 0.2, 2 * rb, rb * 0.52);
    // pink, moist corners (caruncle)
    [L.xl, L.xr].forEach((x) => {
      const cg = ctx.createRadialGradient(x, e.y, 0, x, e.y, rb * 0.32);
      cg.addColorStop(0, 'rgba(170,90,84,0.6)'); cg.addColorStop(0.45, 'rgba(170,105,96,0.22)'); cg.addColorStop(1, 'rgba(178,110,100,0)');
      ctx.fillStyle = cg; ctx.fillRect(x - rb * 0.32, e.y - rb * 0.32, rb * 0.64, rb * 0.64);
    });
    catchlight(e.x + 0.35 * off * cos(dir), e.y + 0.35 * off * sin(dir), ri, lphi);
    ctx.restore();
    ctx.restore();
  });
  if (vig && recorder) drawingContext.drawImage(vig.elt, 0, 0, width, height);   // videos include the vignette
  if (showCam) camView();
  runCalib();
  breathe(dt);
  adapt();
}

// ---------- the creature ----------

// the eyes float a little in place and flinch away from a startle
function creatureMoves(t, dt) {
  cell = lerp(cell, cellT, min(1, dt * 1.2));   // after a change of count the eyes grow or shrink slowly
  if (AROUND && faces.length && millis() > slotsAt) { assignSlots(); slotsAt = millis() + 400; }
  eyes.forEach((e) => {
    const p = e.face >= 0 && faces[e.face], here = p && e.has && e.sleep < 0.5 && AROUND;
    e.gath = lerp(e.gath, here ? 1 : 0, min(1, dt * 1.5));
    let tx = here ? e.sx : e.hx, ty = here ? e.sy : e.hy;   // its spot around you, or its own place in the scatter
    if (shock > 0.3) {                      // startled: away from the sound or movement
      const ax = e.x - startle.x, ay = e.y - startle.y, d = sqrt(ax * ax + ay * ay) || 1;
      tx += ax / d * cell * 0.4 * shock; ty += ay / d * cell * 0.4 * shock;
    }
    const wob = cell * lerp(0.12, 0.03, e.gath);   // held still while they watch you
    tx += (noise(t * 0.15, e.phase) - 0.5) * wob; ty += (noise(e.phase, t * 0.15) - 0.5) * wob;
    // glide there, each eye at its own pace, curving around your face
    const w = e.pace, steps = constrain(ceil(dt * 60), 1, 6), h = dt / steps;
    range(steps).forEach(() => {
      let ax = w * w * (tx - e.x) - 2 * w * e.mvx, ay = w * w * (ty - e.y) - 2 * w * e.mvy;   // critically damped: glide in and settle, no overshoot
      faces.forEach((q) => {   // keep off every face: pushed out to the side, so paths bend around it
        const dx = e.x - q.x, dy = (e.y - q.y) * 1.3, d = sqrt(dx * dx + dy * dy) || 1, r = cell * AROUND_HOLE * 1.1;
        if (d < r) { const f = (r - d) / r * w * w * r * 3; ax += dx / d * f; ay += dy / d * f / 1.3; }
      });
      e.mvx += ax * h; e.mvy += ay * h; e.x += e.mvx * h; e.y += e.mvy * h;
    });
  });
  if (AROUND && faces.length) separate();
}

// spots in loose rings around each person (only those on screen); every eye watching that person takes the
// free spot nearest to it, inner rings first. Redone a few times a second, preferring the spot it already has,
// so the eyes settle instead of swapping
let slotsAt = 0;
function assignSlots() {
  eyes.forEach((e) => { e.has = false; });
  faces.forEach((p, fi) => {
    const group = eyes.filter((e) => e.face === fi && e.sleep < 0.5);
    if (!group.length) return;
    const slots = [], gap = cell * 0.9;
    range(8).forEach((k) => {
      if (slots.length >= group.length * 1.5) return;
      const rx = cell * (AROUND_HOLE + 0.62 * k) * 1.1, ry = rx * 0.7, n = max(5, floor(TWO_PI * sqrt((rx * rx + ry * ry) / 2) / gap));
      range(n).forEach((i) => {
        const a = (i + 0.5 * (k % 2)) / n * TWO_PI, x = p.x + cos(a) * rx, y = p.y + sin(a) * ry;
        if (x > cell * 0.3 && x < width - cell * 0.3 && y > cell * 0.25 && y < height - cell * 0.25) slots.push({ x, y, k });
      });
    });
    const pairs = [];
    group.forEach((e) => slots.forEach((sl, j) => {
      let c = sqrt(sq(sl.x - e.x) + sq(sl.y - e.y)) + sl.k * cell * 3;   // inner ring first, even if it is a longer trip
      if (e.sxPrev !== undefined && sq(sl.x - e.sx) + sq(sl.y - e.sy) < sq(gap * 0.6)) c -= gap * 0.8;   // keep its spot
      pairs.push([c, e, j]);
    }));
    pairs.sort((a, b) => a[0] - b[0]);
    const taken = new Set();
    pairs.forEach(([, e, j]) => {
      if (e.has || taken.has(j)) return;
      e.has = true; taken.add(j); e.sx = slots[j].x; e.sy = slots[j].y; e.sxPrev = 1;
    });
  });
  eyes.forEach((e) => { if (!e.has) e.sxPrev = undefined; });
}

// gathered eyes must not pile up: push overlapping ones apart a little each frame (eye-shaped distance)
function separate() {
  const bs = cell * IRIS_IN_CELL / 0.9;
  eyes.forEach((a, i) => eyes.forEach((b, j) => {
    if (j <= i) return;
    const A = 0.92 * bs * (a.s + b.s), B = 0.6 * bs * (a.s + b.s);
    const dx = b.x - a.x, dy = b.y - a.y, d = sqrt(sq(dx / A) + sq(dy / B));
    if (d >= 1 || d === 0) return;
    const push = (1 - d) * 0.25, ux = dx / A / d, uy = dy / B / d;
    a.x -= ux * push * A; a.y -= uy * push * B; b.x += ux * push * A; b.y += uy * push * B;
  }));
}

// someone arrived while it slept: the eyes open one by one, nearest to them first
function wakeWave(x, y) {
  const now = millis();
  eyes.forEach((e) => { e.wakeAt = now + sqrt(sq(e.hx - x) + sq(e.hy - y)) / width * WAKE_SPREAD * 1000 + random(0, 150); });
}

// breathing: filtered noise swelling in and out, with a low tone underneath. Slow and deep while it sleeps,
// quicker and louder the more eyes are awake and watching someone (Web Audio, made here, nothing is recorded)
let voice = null;
function startBreath() {
  if (voice || !BREATH) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
    d.forEach((_, i) => { d[i] = Math.random() * 2 - 1; });
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const g = ac.createGain(); g.gain.value = 0;
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = 48;
    const og = ac.createGain(); og.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(ac.destination); osc.connect(og); og.connect(ac.destination);
    src.start(); osc.start();
    voice = { ac, lp, g, og, osc, phase: 0 };
  } catch (e) { console.warn('no sound:', e); }
}
function breathe(dt) {
  if (!voice || voice.ac.state !== 'running') return;
  let awake = 0, watching = 0, near = 0, moving = 0;
  eyes.forEach((e) => {
    awake += 1 - e.sleep; if (e.face >= 0 && e.sleep < 0.5) watching++;
    near += e.gath; moving += sqrt(e.mvx * e.mvx + e.mvy * e.mvy);
  });
  awake /= eyes.length; watching /= eyes.length; near /= eyes.length; moving /= eyes.length;
  // gathered round you and settled: it holds its breath while it stares (and lets it go as you leave)
  voice.stare = lerp(voice.stare || 0, near * (1 - constrain(moving / (cell * 0.4), 0, 1)), min(1, dt * 0.8));
  const hold = voice.stare;
  voice.phase += dt * (0.1 + 0.15 * awake + 0.12 * near * (1 - hold) + 0.3 * shock) * (1 - 0.75 * hold);   // breaths per second
  const s = sin(TWO_PI * voice.phase), env0 = s > 0 ? pow(s, 1.5) : 0.35 * pow(-s, 2);   // in-breath stronger than out
  const env = lerp(env0, 0.35 + 0.12 * env0, hold);   // held: a quiet, almost still breath
  const now = voice.ac.currentTime, loud = 0.05 + 0.07 * watching + 0.1 * near + 0.1 * shock;   // closer = louder
  voice.g.gain.setTargetAtTime(env * loud, now, 0.08);
  voice.lp.frequency.setTargetAtTime((200 + 650 * env * (0.5 + watching)) * (1 - 0.35 * near), now, 0.08);   // closer = warmer, darker
  voice.og.gain.setTargetAtTime(0.015 + 0.035 * watching + 0.04 * near, now, 0.4);   // and more body underneath
  voice.osc.frequency.setTargetAtTime(44 + 8 * watching - 6 * near + 20 * shock, now, 0.4);
}

// where this eye wants to look: its chosen person, a newcomer, a startle, or (nobody there) its quiet idle gaze
// ripple: an eye far from where you are sees you a little later, so a turn travels across the screen like a wave
function delayed(o, e) {
  if (!o.hist || RIPPLE <= 0) return o;
  const tm = millis() - 1000 * RIPPLE * constrain(abs(e.x - o.x) / width, 0, 1);
  let g = o.hist[0];
  o.hist.forEach((hst) => { if (hst.t <= tm) g = hst; });
  return g || o;
}
function remember(o, now) {   // keep the last moment of positions for delayed()
  if (!o.hist) o.hist = [];
  o.hist.push({ t: now, x: o.x, y: o.y, z: o.z });
  while (o.hist.length > 2 && o.hist[0].t < now - 1000 * RIPPLE - 100) o.hist.shift();
}

function gazeTarget(e, t, dt) {
  e.face = faces.length ? min(faces.length - 1, floor(e.pick * faces.length)) : -1;
  // startled: everyone snaps toward the sound or movement (each a split second apart)
  if (t - startle.at > e.jolt && t - startle.at < 1 + e.jolt) return { x: startle.x, y: startle.y, z: width * FACE_DIST * 0.8 };
  // someone new arrived: for a moment all eyes turn to them
  if (newcomer && millis() < newcomer.until && faces.includes(newcomer.p)) return delayed(newcomer.p, e);
  if (QUIET && !faces.length) return quietGaze(e, t);
  const who = e.face >= 0 ? faces[e.face] : focus;
  return delayed(who, e);
}

// nobody there: each eye looks at a neighbour or lets its gaze drift; a neighbour sometimes looks back and blinks
function quietGaze(e, t) {
  if (t > e.qNext) {
    e.qNext = t + random(2, 6);
    e.qEye = null;
    if (random() < 0.5) {
      const near = eyes.filter((o) => o !== e).sort((a, b) => sq(a.x - e.x) + sq(a.y - e.y) - sq(b.x - e.x) - sq(b.y - e.y));
      e.qEye = random(near.slice(0, 3));
      const o = e.qEye;
      if (o && o.sleep < 0.5 && random() < 0.5) { o.qEye = e; o.qNext = t + random(2, 4); o.blinkAt = min(o.blinkAt, t + random(0.4, 0.9)); }
    } else { e.qx = random(0.1, 0.9) * width; e.qy = random(0.15, 0.85) * height; }
  }
  return e.qEye ? { x: e.qEye.x, y: e.qEye.y, z: cell * 0.9, own: true } : { x: e.qx, y: e.qy, z: width * FACE_DIST * 1.5 };
}

// eyelids: an almond opening that follows the vertical gaze and closes in blinks (fast down, slower up)
function lids(e, rb, t) {
  if (e.blinkStart < 0 && t >= e.blinkAt) e.blinkStart = t;
  let c = 0;
  if (e.blinkStart >= 0) {
    const u = (t - e.blinkStart) / e.ty.dur;
    if (u >= 1) { e.blinkStart = -1; e.blinkAt = t + random(e.ty.blink[0], e.ty.blink[1]) * (random() < 0.15 ? 0.1 : 1); }   // sometimes a double blink
    else c = u < 0.35 ? sstep(0, 0.35, u) : 1 - sstep(0.35, 1, u);
  }
  if (e.sleep > 0) c = max(c, e.sleep >= 1 ? 1 : e.sleep * (0.75 + 0.25 * noise(t * 0.6, e.phase)));   // drowsy lids sag and flutter
  const vg = constrain((e.gy * cos(e.rot) - e.gx * sin(e.rot)) / radians(MAX_TURN), -1, 1), open = e.ty.lid * (1 + 0.3 * shock);   // wide open when startled
  let up = e.y - rb * (0.5 - 0.35 * vg) * open, lo = e.y + rb * (0.42 + 0.18 * vg);
  const meet = lerp(up, lo, 0.75);
  up = lerp(up, meet, c); lo = lerp(lo, meet, c);
  // quadratic control points that make each curve pass through its apex
  return { xl: e.x - rb * 0.98, xr: e.x + rb * 0.98, cu: 2 * up - e.y, cl: 2 * lo - e.y, open, shut: c };
}

function lidPath(ctx, cx, cy, L) {
  ctx.beginPath(); ctx.moveTo(L.xl, cy);
  ctx.quadraticCurveTo(cx, L.cu, L.xr, cy); ctx.quadraticCurveTo(cx, L.cl, L.xl, cy);
  ctx.closePath();
}

// fine red veins in the white, baked once per eye: they grow in from the corners toward the iris and branch
function makeVeins(e) {
  const V = 160, g = createGraphics(V, V), c = g.drawingContext;
  g.pixelDensity(1); g.clear();
  c.lineCap = 'round';
  const grow = (x, y, a, w, n) => {
    let done = false;
    range(n).forEach(() => {
      if (done) return;
      const nx = x + cos(a) * V * 0.025, ny = y + sin(a) * V * 0.025;
      c.strokeStyle = `rgba(${floor(random(150, 190))},${floor(random(30, 60))},${floor(random(40, 60))},${(0.25 + 0.4 * e.red) * w})`;
      c.lineWidth = 0.4 + 1.1 * w;
      c.beginPath(); c.moveTo(x, y); c.lineTo(nx, ny); c.stroke();
      x = nx; y = ny; a += random(-0.5, 0.5);
      if (sqrt(sq(x - V / 2) + sq(y - V / 2)) < V * 0.24) { done = true; return; }   // stop at the iris
      if (w > 0.3 && random() < 0.18) grow(x, y, a + random([-1, 1]) * random(0.5, 1.1), w * 0.6, floor(n * 0.5));
      w *= 0.93;
    });
  };
  range(floor(4 + 8 * e.red)).forEach(() => {
    const side = random() < 0.5 ? 0 : PI, a0 = side + random(-0.55, 0.55);   // mostly from the corners
    grow(V / 2 + cos(a0) * V * 0.48, V / 2 + sin(a0) * V * 0.48, a0 + PI + random(-0.4, 0.4), random(0.5, 1), floor(random(6, 13)));
  });
  return g;
}

// the white of the eye: a shaded ball that stays put while the iris rotates across it
function sclera(cx, cy, rb, phi) {
  const ctx = drawingContext, lx = cx + 0.35 * rb * cos(phi), ly = cy + 0.35 * rb * sin(phi);
  const gr = ctx.createRadialGradient(lx, ly, rb * 0.05, cx, cy, rb);
  gr.addColorStop(0, 'rgb(222,214,204)');     // off-white: a real sclera is never paper white
  gr.addColorStop(0.55, 'rgb(192,182,172)');
  gr.addColorStop(0.85, 'rgb(118,106,102)');
  gr.addColorStop(1, 'rgb(20,18,20)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(cx, cy, rb, 0, Math.PI * 2); ctx.fill();
}

function catchlight(cx, cy, r, phi) {
  const ctx = drawingContext, x = cx + r * 0.5 * cos(phi), y = cy + r * 0.5 * sin(phi);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.11, r * 0.085, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.31)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.035, r * 0.025, 0, 0, TWO_PI); ctx.fill();
}

// ---------- face tracking ----------

async function startTracking() {
  try {
    cam = createCapture(VIDEO);
    cam.size(320, 240);
    // keep the video "on the page" but invisible: a hidden (display: none) video is not refreshed by some
    // browsers (iPhone Safari especially), so the face search would keep looking at an old frame
    cam.elt.setAttribute('playsinline', ''); cam.elt.muted = true;
    cam.style('position', 'fixed'); cam.style('left', '0'); cam.style('top', '0');
    cam.style('width', '2px'); cam.style('height', '2px'); cam.style('opacity', '0.01'); cam.style('pointer-events', 'none');
    const vision = await import(MP + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
    const make = (delegate) => BLINK_BACK
      ? vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: LMODEL, delegate },
        runningMode: 'VIDEO', numFaces: MAX_FACES, outputFaceBlendshapes: true,
      })
      : vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO', minDetectionConfidence: 0.5,
      });
    let used = PHONE ? 'GPU' : DELEGATE;   // phones run the face search much faster on their graphics chip
    try { detector = await make(used); } catch (e) { if (used === 'CPU') throw e; used = 'CPU'; detector = await make(used); }
    console.log('face tracking on (' + used + ')' + (BLINK_BACK ? ', blink back' : ''));
    // look at each new camera frame as it arrives (where the browser can say so), never at an old one
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      rvfc = true;
      const onFrame = () => {
        if (rvfc && millis() - lastDetect > detectInterval()) { lastDetect = millis(); detectNow(); }
        cam.elt.requestVideoFrameCallback(onFrame);
      };
      cam.elt.requestVideoFrameCallback(onFrame);
    }
  } catch (e) {
    console.warn('face tracking off (eyes will idle):', e);
  }
}

// one detection: a list of faces as { fx, fy, w } (0..1 of the camera image) and, with landmarks, how shut the eyes are
// which part of the camera image to search: the whole frame, or a 2x zoom. The face model only finds faces
// up to about 2 m in the whole frame, so when it finds nobody the next looks sweep zoomed left, centre and right,
// and a zoom follows people who are only found that way (every 4th look still checks the whole frame).
const FULL = { x: 0, y: 0, s: 1 }, HUNT = [{ x: 0.25, y: 0.2, s: 0.5 }, { x: 0, y: 0.2, s: 0.5 }, { x: 0.5, y: 0.2, s: 0.5 }];
let zoom = null, hunt = 0, detN = 0, lastFound = [], lastCrop = FULL, showCam = false;

function detectFaces(v) {
  const vw = v.videoWidth || 640, vh = v.videoHeight || 480, port = vh > vw;   // phones in portrait give a tall image
  const L = BLINK_BACK ? 320 : 160, S = L * 3 / 4, SW = port ? S : L, SH = port ? L : S;
  const wk = port ? vw / vh : 1;   // face width as a fraction of the long side, so distance reads the same both ways
  const c = zoom && ++detN % 4 ? zoom : FULL;
  if (!small || small.width !== SW) { small = document.createElement('canvas'); small.width = SW; small.height = SH; }
  small.getContext('2d').drawImage(v, c.x * vw, c.y * vh, c.s * vw, c.s * vh, 0, 0, SW, SH);
  let found;
  if (!BLINK_BACK) {
    // detect on a 160x120 copy: much cheaper, and the model shrinks its input to 128 px anyway
    found = detector.detectForVideo(small, performance.now()).detections.slice(0, MAX_FACES).map((f) => {
      const bb = f.boundingBox;
      return { fx: (bb.originX + bb.width / 2) / SW, fy: (bb.originY + bb.height / 2) / SH, w: bb.width / SW * wk, shut: -1 };
    });
  } else {
    const res = detector.detectForVideo(small, performance.now());
    found = res.faceLandmarks.map((lm, i) => {
      let shut = 0;
      const bs = res.faceBlendshapes && res.faceBlendshapes[i];
      if (bs) bs.categories.forEach((k) => { if (k.categoryName === 'eyeBlinkLeft' || k.categoryName === 'eyeBlinkRight') shut = max(shut, k.score); });
      // 234 / 454 = the sides of the face, 168 = between the eyes
      return { fx: (lm[234].x + lm[454].x) / 2, fy: lm[168].y, w: abs(lm[454].x - lm[234].x) * wk, shut };
    });
  }
  // back to whole-frame coordinates
  found.forEach((f) => { f.fx = c.x + f.fx * c.s; f.fy = c.y + f.fy * c.s; f.w *= c.s; });   // (w stays in long-side units)
  const zoomOn = (fs) => {
    let mx = 0, my = 0;
    fs.forEach((f) => { mx += f.fx / fs.length; my += f.fy / fs.length; });
    return { x: constrain(mx - 0.25, 0, 0.5), y: constrain(my - 0.25, 0, 0.5), s: 0.5, track: true };
  };
  if (c === FULL) {
    if (found.length) zoom = found.every((f) => f.w < 0.1) ? zoomOn(found) : null;   // everyone small = far: zoom in on them
    else if (!zoom || !zoom.track) zoom = HUNT[hunt++ % 3];                       // nobody: search zoomed next
  } else if (found.length) zoom = zoomOn(found);                                   // keep the zoom on them as they move
  else zoom = HUNT[hunt++ % 3];
  lastCrop = c; lastFound = found;
  return found;
}

// D key: the camera image (mirrored, like a mirror) with the faces found and the area searched
function camView() {
  const v = cam && cam.elt;
  if (!v || v.readyState < 2) return;
  const W = min(200, width * 0.45), H = W * (v.videoHeight || 3) / (v.videoWidth || 4), X = width - W - 12, Y = 12, ctx = drawingContext;
  ctx.save(); ctx.translate(X + W, Y); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
  noFill(); strokeWeight(1);
  stroke(255, 200, 0); rect(X + (1 - lastCrop.x - lastCrop.s) * W, Y + lastCrop.y * H, lastCrop.s * W, lastCrop.s * H);
  stroke(0, 255, 120);
  lastFound.forEach((f) => rect(X + (1 - f.fx - f.w / 2) * W, Y + f.fy * H - f.w * W / 2, f.w * W, f.w * W));
  noStroke(); fill(255); textSize(12);
  text(faces.length + (faces.length === 1 ? ' person' : ' people') + (lastCrop.s < 1 ? ' (zoomed search)' : ''), X, Y + H + 16);
}

// room brightness from a 16x12 copy of the camera (note: the webcam's auto exposure evens out slow changes)
function measureLight(v) {
  if (!tiny) { tiny = document.createElement('canvas'); tiny.width = 16; tiny.height = 12; }
  const c = tiny.getContext('2d', { willReadFrequently: true });
  c.drawImage(v, 0, 0, 16, 12);
  const px = c.getImageData(0, 0, 16, 12).data;
  const lum = new Float32Array(192);
  let sum = 0;
  range(192).forEach((i) => { lum[i] = px[4 * i] * 0.3 + px[4 * i + 1] * 0.55 + px[4 * i + 2] * 0.15; sum += lum[i]; });
  light = lerp(light, sum / 192 / 255, 0.15);
  // sudden movement: a big change since the last look; the eyes snap to where most of it happened
  if (STARTLE_MOTION && prevLum) {
    let d = 0, cx = 0, cy = 0;
    range(192).forEach((i) => { const k = abs(lum[i] - prevLum[i]); d += k; cx += k * (i % 16); cy += k * floor(i / 16); });
    if (d / 192 > MOTION_LEVEL) startleAt((1 - (cx / d + 0.5) / 16) * width, (cy / d + 0.5) / 12 * height);
  }
  prevLum = lum;
}

function startleAt(x, y) {
  if (millis() / 1000 - startle.at < 4 || millis() - startMs < 3000) return;   // not again for a few seconds, nor while the camera starts
  startle.at = millis() / 1000; startle.x = x; startle.y = y;
  eyes.forEach((e) => { e.sleep = 0; e.blinkStart = -1; e.blinkAt = startle.at + random(1.2, 2.5); });
  console.log('startle');
}

// microphone level (Web Audio, nothing recorded or sent); a sound much louder than the room startles
async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const an = ac.createAnalyser(), mute = ac.createGain();
    an.fftSize = 512; mute.gain.value = 0;
    ac.createMediaStreamSource(stream).connect(an); an.connect(mute); mute.connect(ac.destination);
    mic = { ac, an, buf: new Float32Array(512), base: 0.01 };
    console.log('sound startle on' + (ac.state === 'running' ? '' : ' (click or press a key once to arm it)'));
  } catch (e) {
    console.warn('sound startle off:', e);
  }
}

function listen() {
  if (!mic || mic.ac.state !== 'running') return;
  mic.an.getFloatTimeDomainData(mic.buf);
  let s = 0;
  mic.buf.forEach((v) => { s += v * v; });
  const rms = sqrt(s / 512);
  if (rms > max(0.05, mic.base * SOUND_LEVEL)) {   // loud: look out at whoever is there, or straight ahead
    const f = faces[0];
    startleAt(f ? f.x : width / 2, f ? f.y : height / 2);
  } else mic.base = lerp(mic.base, rms, 0.02);
}

// camera position (0..1) to screen: mirrored (you on the right of the camera = right of the screen), widened by GAIN.
// After a calibration (C key) the middle of the room is the middle of the screen and its sides are near the edges.
const toScreenX = (fx) => calib ? width / 2 + (calib.cx - fx) / calib.half * width * 0.45 : width / 2 + (0.5 - fx) * width * GAIN;
const toScreenY = (fy) => height / 2 + (fy - (calib ? calib.cy : 0.45)) * height * GAIN;

// ---------- calibration (C key) ----------
// For a wall, a projector or a camera off to one side: stand in the middle, then at one side, then the other.
// Each step waits a few seconds and takes where the camera sees you. Saved in this browser; ?calib=0 forgets it.
let calib = loadCalib(), calibRun = null;
function loadCalib() {
  try {
    if (Q.get('calib') === '0') { localStorage.removeItem('iris-calib'); return null; }
    const c = JSON.parse(localStorage.getItem('iris-calib'));
    return c && c.half > 0.02 ? c : null;
  } catch (e) { return null; }
}
const CALIB_STEPS = ['Stand in the middle, facing the screen', 'Now go to one side of where people will stand', 'Now go to the other side'];
function startCalib() {
  if (calibRun) { calibRun = null; showCam = false; return; }   // C again: cancel, keep the old one
  calibRun = { step: 0, at: millis() + 4000, got: [] };
  showCam = true;
}
function runCalib() {
  if (!calibRun) return;
  const now = millis(), left = ceil((calibRun.at - now) / 1000), f = faces[0];
  if (now >= calibRun.at) {
    if (f && now - f.lastSeen < 300) {
      calibRun.got.push({ x: f.fx.x(), y: f.fy.x() });
      calibRun.step++;
      calibRun.at = now + 5000;
    } else calibRun.at = now + 2000;   // nobody seen: wait and try again
  }
  if (calibRun.step === 3) {
    const [m, a, b] = calibRun.got, half = (abs(a.x - m.x) + abs(b.x - m.x)) / 2;
    if (half > 0.02) {
      calib = { cx: m.x, cy: m.y, half };
      try { localStorage.setItem('iris-calib', JSON.stringify(calib)); } catch (e) { /* kept for this visit only */ }
    }
    calibRun = null; showCam = false;
    return;
  }
  noStroke(); fill(BG[0], BG[1], BG[2], 210); rect(0, height / 2 - 60, width, 110);   // a dark band so the words read over the eyes
  fill(230); textAlign(CENTER, CENTER); textSize(max(16, width / 50));
  text(CALIB_STEPS[calibRun.step], width / 2, height / 2 - 20);
  textSize(max(12, width / 80)); fill(150);
  text(f ? (left > 0 ? left : 'hold still') : 'looking for you…', width / 2, height / 2 + 20);
  textAlign(LEFT, BASELINE);
}

// One Euro filter (Casiez, Roussel & Vogel, CHI 2012): smooths jitter when you are still, but follows fast moves
// without lag; it also gives a speed, used to predict where you are between camera checks
function euro(minCut, beta) {
  let x = null, dx = 0, tp = 0;
  const alpha = (cut, dt) => { const r = TWO_PI * cut * dt; return r / (r + 1); };
  return {
    x: () => x, v: () => dx,
    f: (val, t) => {
      if (x === null) { x = val; tp = t; return x; }
      const dt = max(0.001, t - tp); tp = t;
      dx += alpha(1, dt) * ((val - x) / dt - dx);
      x += alpha(minCut + beta * abs(dx), dt) * (val - x);
      return x;
    },
  };
}

let detMs = 10, rvfc = false, lightN = 0, fpsTarget = 60, curRate = 60, lowCount = 0, drops = 0, droppedAt = 0, drawMs = 5;
// how often to look: often while someone is there, rarely when nobody is, and never more than ~25% of the time
const detectInterval = () => max(faces.length ? 66 : 150, detMs * 4, BLINK_BACK ? 100 : 0);

function detectNow() {
  const v = cam && cam.elt;
  if (!detector || !v || v.readyState < 2) return;
  try {
    const t0 = performance.now();
    if (++lightN % 2 === 0) measureLight(v);   // light and movement: every other look is enough
    const found = detectFaces(v);
    detMs = lerp(detMs, performance.now() - t0, 0.2);
    updateFaces(found);
  } catch (e) { /* skip this frame */ }
}

// match each face found to the nearest known person (so they keep their history and their eyes), add newcomers
function updateFaces(found) {
  const now = millis(), t = now / 1000, matched = [];
  found.forEach((f) => {
    let p = null, bd = 0.2;
    faces.forEach((o) => { if (matched.includes(o)) return; const d = sqrt(sq(o.fx.x() - f.fx) + sq(o.fy.x() - f.fy)); if (d < bd) { bd = d; p = o; } });
    if (!p) {
      if (faces.length >= MAX_FACES) return;
      p = { fx: euro(0.3, 1), fy: euro(0.3, 1), w: euro(0.5, 1), since: now, wasShut: false, close: 0, x: toScreenX(f.fx), y: toScreenY(f.fy), z: width * FACE_DIST };
      if (faces.length) newcomer = { p, until: now + 3000 };                                     // someone joined: all eyes turn to them
      else if (eyes.some((e) => e.sleep > 0.3)) wakeWave(toScreenX(f.fx), toScreenY(f.fy));   // woken up by someone arriving
      faces.push(p);
    }
    matched.push(p);
    p.fx.f(f.fx, t); p.fy.f(f.fy, t); p.w.f(f.w, t);
    p.lastSeen = p.tDet = now;
    p.close = sstep(0.15, 0.5, p.w.x());
    if (f.shut > 0.5 && !p.wasShut) {      // you blinked: the eyes watching you blink back, a moment later
      p.wasShut = true;
      const i = faces.indexOf(p);
      eyes.forEach((e) => { if (e.face === i && e.blinkStart < 0) e.blinkAt = t + random(0.05, 0.2); });
    } else if (f.shut >= 0 && f.shut < 0.35) p.wasShut = false;
  });
  if (found.length) seenAt = now;
}

function track() {
  const now = millis();
  // without frame callbacks (or if they stop coming), look from here instead
  if (rvfc && now - lastDetect > 1500) rvfc = false;
  if (!rvfc && now - lastDetect > detectInterval()) { lastDetect = now; detectNow(); }
  listen();
  faces = faces.filter((p) => now - p.lastSeen < HOLD_MS);   // someone lost for a moment is held on to, then let go
  faces.forEach((p) => {
    // predicted position: filtered position plus its speed times the time since the last look (stops when lost)
    const lead = min(0.15, (now - p.tDet) / 1000 + 0.05) * max(0, 1 - (now - p.lastSeen) / 600);
    const tx = toScreenX(p.fx.x() + p.fx.v() * lead), ty = toScreenY(p.fy.x() + p.fy.v() * lead);
    const tz = width * FACE_DIST * constrain(0.3 / p.w.x(), 0.4, 2);   // a bigger face = closer = more convergence
    p.x = lerp(p.x, tx, 0.3); p.y = lerp(p.y, ty, 0.3); p.z = lerp(p.z, tz, 0.15);
  });
  if (faces.length) { focusT.x = faces[0].x; focusT.y = faces[0].y; focusT.z = faces[0].z; }   // idle starts from where they were
  else if (now > idleNext) {   // nobody there: the eyes drift to a new point together
    focusT.x = random(0.2, 0.8) * width; focusT.y = random(0.25, 0.75) * height; focusT.z = width * FACE_DIST * 1.5;
    idleNext = now + random(2000, 5000);
  }
  focus.x = lerp(focus.x, focusT.x, 0.5); focus.y = lerp(focus.y, focusT.y, 0.5); focus.z = lerp(focus.z, focusT.z, 0.2);
  remember(focus, now); faces.forEach((p) => remember(p, now));
}

function setEyes(n) {
  layout(n);
  lastAdapt = millis() + 2000;   // let the new eyes settle before measuring again
  try { localStorage.setItem(savedKey(), EYES); } catch (e) { /* remembered for this visit only */ }
  console.log(EYES + ' eyes');
}

function adapt() {
  fpsAvg = lerp(fpsAvg, frameRate(), 0.05);
  // all asleep: run slowly (saves battery and heat in an installation); awake again at the normal rate
  const want = eyes.every((e) => e.sleep >= 1) ? 20 : fpsTarget;
  if (want !== curRate) { curRate = want; frameRate(want); fpsAvg = want; lastAdapt = millis(); }   // measure afresh after a change
  if (millis() - lastAdapt > 2000 && millis() - startMs > 4000 && want === fpsTarget) {
    lastAdapt = millis();
    // a machine that can't keep 60 gets a steady 30 (even timing looks smoother than a wobbly 40);
    // below that the iris buffers shrink
    // (it must be slow twice in a row, so a hiccup while the face model loads doesn't count, and it tries 60 again
    // after a while if the machine was only busy; after two drops it stays at 30)
    lowCount = fpsTarget === 60 && fpsAvg < 45 ? lowCount + 1 : 0;
    const awakeN = eyes.filter((e) => e.sleep < 0.5).length;
    if (lowCount >= 2 && ADAPT_EYES && EYES > minEyes) {   // too many: a fifth fewer (far too many: 40% fewer), and never this many again here
      ceilEyes = EYES - 1; lowCount = 0;
      setEyes(floor(EYES * (fpsAvg < 30 ? 0.6 : 0.8)));
    } else if (lowCount >= 2) { fpsTarget = curRate = 30; frameRate(30); fpsAvg = 30; lowCount = 0; drops++; droppedAt = millis(); }
    else if (ADAPT_EYES && fpsTarget === 60 && fpsAvg > 56 && drawMs < 9 && awakeN > EYES * 0.7 && EYES < min(ceilEyes, mostEyes())) {
      setEyes(min(ceilEyes, EYES + max(2, round(EYES * 0.25))));   // smooth with most eyes open: a quarter more
    }
    else if (fpsTarget === 30 && drops < 2 && millis() - droppedAt > 15000 && drawMs < 8) { fpsTarget = curRate = 60; frameRate(60); fpsAvg = 60; }
    else if (fpsAvg < 25 && N > MIN_BUF) makeTables(max(MIN_BUF, floor(N * 0.85)));
  }
}

// ---------- exhibition controls ----------

function keyPressed() {
  armSound();
  const k = String(key).toLowerCase();
  if (k === 'f') {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); noCursor(); }
    else { document.exitFullscreen(); cursor(); }
  }
  if (k === 's' && vig) drawingContext.drawImage(vig.elt, 0, 0, width, height);   // stills include it too
  if (k === 's') saveCanvas('iris-grid-' + seed + '-' + frameCount, 'png');
  if (k === 'r') recolour();
  if (k === 'v') toggleRecording();
  if (k === 'd') showCam = !showCam;
  if (k === 'c') startCalib();
}
// double-tap (phone) or double-click: show or hide the camera view, like the D key
let lastTap = -1e9;
function mousePressed() {
  armSound();
  if (millis() - lastTap < 400) { showCam = !showCam; lastTap = -1e9; } else lastTap = millis();
}
function armSound() {
  if (mic && mic.ac.state !== 'running') mic.ac.resume();
  startBreath();
  if (voice && voice.ac.state !== 'running') voice.ac.resume();
}   // browsers start audio only after a click or key

// new colours for every eye, one eye per frame so there is no pause
function recolour() {
  const pals = naturalPalettes(eyes.length);
  eyes.forEach((e, i) => jobs.push(() => { e.pal = pals[i]; colourise(e); }));
}

// record the canvas to a video file (WebM, or MP4 in Safari), saved when you press V again
function toggleRecording() {
  if (recorder) { recorder.stop(); return; }
  const type = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) { console.warn('video recording is not supported in this browser'); return; }
  const chunks = [];
  recorder = new MediaRecorder(drawingContext.canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
  recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type }));
    a.download = 'iris-grid-' + seed + '-' + Date.now() + (type.includes('mp4') ? '.mp4' : '.webm');
    a.click();
    recorder = null; recDot.style.display = 'none';
  };
  recorder.start(1000);
  if (!recDot) {   // a small red dot on the page (not in the video) while recording
    recDot = document.createElement('div');
    recDot.style.cssText = 'position:fixed;top:12px;left:12px;width:10px;height:10px;border-radius:50%;background:#d22;z-index:9';
    document.body.appendChild(recDot);
  }
  recDot.style.display = 'block';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}
