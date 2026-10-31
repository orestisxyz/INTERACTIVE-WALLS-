// Iris — ORE.XYZ MAKE #07. Part of Interactive Walls (github.com/orestisxyz/INTERACTIVE-WALLS-).
// A shy beast made of eyes in the dark. It watches you through the webcam (MediaPipe face detection, on this
// device only: nothing is recorded, sent or recognised) and listens through the microphone.
//
// The story (story=1):
// 1 arrive: the eyes run from you to the edges, look away and steal glances; moving or noise makes it worse
// 2 stand still and quiet: trust builds over `calm` seconds; moving (`lose`) and noise (`hush`) take it away,
//   a rush, a bang or a clap frightens it (the eyes shut and flinch). The bravest eyes come closer first
// 3 the pact: at full trust every eye shuts, then opens wide, nearest first, with one deep breath
// 4 companion: it follows you; stop, and it gathers round you and grows, humming; a sound and it keeps watch for
//   you; stay still about a minute (`rest`) and it falls asleep beside you, one eye now and then checking on you
// 5 a stranger comes: it guards you until they have stayed calm for `accept` seconds
// 6 you leave: out of view for `hold` seconds, you are gone; it watches the side you left by and lets out one long
//   breath. Come back the same way within `remember` seconds and it greets you with your trust kept; anyone else
//   starts the story afresh
// Around it: each eye is a "lost soul" that lives a while (`life` seconds), fades, and is born again elsewhere
// (the eyes near it turn to watch it go, and the breath catches: `mourn`); each soul has a voice of its own: a
// bing when it blinks, its note when it is born, a whisper when it dies (`voices`); all its sounds ring in a large
// dark room (`reverb`) and come from where they happen (`stereo`); a fright makes it gasp (`gasp`);
// the day's mood (frights make it shyer for the next visitors, friends make it bolder); a narrator line at the
// bottom says what is happening and what to do (`words`) in Greek, English, Hungarian or Spanish (`lang`, and a
// switch in the top-right corner).
//
// How it is drawn: an iris structure is painted once into an unwrapped strip and each eye recolours it with its
// own natural palette (measured from reference photos). Each eye's iris image is re-rendered a few times a
// second, round robin; the turning and lids are cheap canvas transforms drawn every frame. The eye count adapts
// to the device (more while it stays smooth, fewer when it stutters). All heavy loops use forEach, so it runs in
// the p5 web editor (loop protection), with p5.js 1.x and 2.x.
//
// Keys: F fullscreen, S save a still, R new colours, V start/stop a video, D what the camera sees (faces, trust,
//   fps, mood), C calibrate for a wall (stand in the middle, then each side), L the narrator's language.
// Installation: kiosk/start_iris.bat and kiosk/SETUP_WINDOWS.md. sw.js keeps a copy of everything in the
//   browser, so it starts without internet after the first time.
// URL settings (all optional), story: calm=16 lose=3 hush=3 shy=1 snap=1.4 tempo=0.6 grow=0.8 trust=0 pact=1
//   accept=8 hold=6 remember=30 mood=1 rest=60 gasp=1 hum=1 mourn=1 words=1 lang=el (el|en|hu|es)
// eyes: most=24 eyes=N (fixed) minsize=100 size=260 space=1.7 life=60-360 seed=N layout=scatter|grid
// look: turn=45 tilt=25 follow=0.55 parallel=0.8 gain=1.6 dist=0.45 ripple=0.15 around=1
// room: sound=1 rhythm=1 motion=0 blink=0 breath=1 reverb=1 stereo=1 voices=1 quiet=1 sleep=20 gpu=0
// installation: kiosk=0 reload=4 dpr=2 offline=1 calib=0 (forgets the calibration)

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
const MOST_EYES = opt('most', 24);   // scattered: as many eyes as the device can draw smoothly, up to this many (24: lost souls)
// life cycle: each eye lives a while (seconds, random between the two), then closes and fades into the dark and
// a new one is born somewhere else, so the count stays the same. Eyes close round a visitor, or guarding them,
// never die then (they age 5x slower); the rest of the ring ages a little slower. life=0: they live for ever
const LIFE = (Q.get('life') || '60-360').split('-').map(Number), LIVES = LIFE[0] > 0;
const DIE_S = 6, BORN_S = 4;   // seconds to fade out, and to fade in
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
const STORY = opt('story', 1) > 0;   // the beast: scared at first, it trusts only someone who stays still; then it follows, and grows round you when you stop (0 = it simply follows)
const SHY = opt('shy', 1);           // how strongly it keeps away and trembles while afraid (0 = not at all)
const TEMPO = opt('tempo', 0.6);     // speed of the eyes' own small acts: darting looks, peeks, trembling (1 = the old quick pace)
const SNAP = opt('snap', 1.4);       // how snappily they come to you and run from you (1 = the old pace)
const LOSE = opt('lose', 3);         // until it trusts you fully, moving loses trust this many times faster than standing still earns it
const HUSH = opt('hush', 3);         // the same for sound: noise loses trust this many times faster than quiet stillness earns it
const CALM = opt('calm', 16);        // seconds of standing still before it trusts you fully
const GROW = opt('grow', 0.8);       // how much bigger the eyes get round you when you stop (0.8 = up to 1.8x)
const ACCEPT = opt('accept', 8);        // seconds a stranger must stay calm before it accepts them (people who come with you are accepted at once)
const REMEMBER = opt('remember', 30);    // seconds it remembers you after you leave: come back in time and it greets you
const BLINK_BACK = opt('blink', 0) > 0;   // 1 = face-landmark model, about 4x heavier (graphics chip first): the eyes blink back, and a slow blink earns extra trust
const LMODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_FACES = 3;            // people the eyes can share their attention between
const HOLD_MS = opt('hold', 6) * 1000;   // seconds it waits for someone the camera has lost (stepped out of view, turned away) before they count as gone
const LAYOUT = Q.get('layout') || 'scatter';   // 'scatter' = loose crowd of different sizes, 'grid' = even rows
const RIPPLE = opt('ripple', 0.15);       // seconds for a turn to travel across the screen from the side nearest you (0 = all at once)
const WAKE_SPREAD = 1.6;        // seconds for the waking wave to cross the screen, nearest eyes first
const BREATH = opt('breath', 1) > 0;    // a low breathing sound (starts after the first click, tap or key)
const QUIET = opt('quiet', 1) > 0;      // with nobody there they look at each other, answer with a blink, and one sometimes stirs in its sleep
const AROUND = opt('around', 1) > 0;   // someone there: each eye finds its own spot in loose rings around them (0 = they stay scattered)
const TURN = opt('turn', 45) * Math.PI / 180;   // each whole eye turns in depth toward you, like a head turning (degrees, 0 = flat)
const TILT = opt('tilt', 25) * Math.PI / 180;    // and spins it flat on the screen so its long axis points at you (degrees, 0 = level)
const FOLLOW = opt('follow', 0.55);   // how much the whole eye turns along with its gaze (0 = only the iris moves, which reads as a fish)
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
const RHYTHM = opt('rhythm', 1) > 0;   // sudden sounds (a clap, a step, a beat) make all the watching eyes jump at once
const STARTLE_MOTION = opt('motion', 0) > 0;   // 1 = sudden movement startles them too (off by default: people walking past set it off)
const SOUND_LEVEL = 4;          // how much louder than the room a sound must be to startle (x average level)
const MOTION_LEVEL = 28;        // how big a sudden change in the camera image must be (0-255)
const DPR = opt('dpr', 2);       // most screen pixels per CSS pixel (1 = lighter on 4K screens and projectors)
const KIOSK = opt('kiosk', 0) > 0;   // an installation: double-click or double-tap no longer opens the camera view (the D key still does)
const MOOD = opt('mood', 1);     // the day's mood: frights make it shyer for the next visitors, a pact makes it bolder (0 = every visitor starts the same)
const REST = opt('rest', 60);    // seconds of stillness as your companion before it falls asleep beside you (0 = never)
const GASP = opt('gasp', 1) > 0;   // a sharp breath in when it is frightened
const HUM = opt('hum', 1) > 0;     // a low warm hum while it is gathered round you
const MOURN = opt('mourn', 1) > 0;   // when a soul dies, the eyes near it turn to it and the breath dips
const REVERB = opt('reverb', 1);   // the room's echo: its sounds ring in a large dark space (0 = dry, 2 = twice as much)
const STEREO = opt('stereo', 1) > 0;   // each sound comes from where it happens on the screen (left or right speaker)
const VOICES = opt('voices', 1);   // the souls' own small sounds: a bing when they blink, a note when born, a whisper when dying (0 = off)
const OFFLINE = opt('offline', 1) > 0;   // keep a copy of everything in the browser, so it starts without internet after the first time

const structs = [];             // { ratio, GR, GA, NZ } per structure
const eyes = [];
let N, irisPx, AI, D, SHADE, ALPHA, inside;   // shared per-pixel lookup tables for the eye buffers
const COS = new Float32Array(A), SIN = new Float32Array(A), CS0 = new Float32Array(A), CZ = new Float32Array(A);
const LR = new Float32Array(A), LA = new Float32Array(A), HR = new Float32Array(A), HA = new Float32Array(A);
let fpsAvg = 60, lastAdapt = 0, startMs, rr = 0, rrAcc = 0, cell = 100;
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
  pixelDensity(min(DPR, displayDensity()));   // sharp on phone and retina screens (the iris buffers follow it); dpr=1 for big 4K screens
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
  setInterval(watchdog, 1000);   // left alone for days: pointer, screen sleep, camera, nightly fresh start
  setTimeout(armSound, 1500);    // sound without a click, where the browser allows it (the kiosk start file does)
  // a copy of every file (p5, the face model, this sketch) kept in the browser, so after one start with internet it
  // also starts without (sw.js next to index.html; in the p5 web editor there is none, and nothing happens)
  if (OFFLINE && 'serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
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
  const tone = (p) => { const m = [0, 0, 0]; [1, 2, 3, 4, 5].forEach((k) => { m[0] += p.ramp[k][0]; m[1] += p.ramp[k][1]; m[2] += p.ramp[k][2]; }); return m.map((v) => v / 5); };
  const keys = cands.map(tone), apart = (u, v) => sqrt(sq(u[0] - v[0]) + sq(u[1] - v[1]) * 1.3 + sq(u[2] - v[2]));
  const have = existing.map(tone), picked = [];
  if (!have.length) { picked.push(floor(random(cands.length))); have.push(keys[picked[0]]); }
  range(n - picked.length).forEach(() => {
    let best = -1, bi = 0;
    cands.forEach((_, i) => { const d = Math.min(...have.map((h) => apart(keys[i], h))); if (d > best) { best = d; bi = i; } });
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
    const e = makeEye(pal, type);
    e.life = random(LIFE[0], LIFE[1] || LIFE[0]); e.age = random(0.8) * e.life;   // the first ones at all ages, so they don't all die together
    eyes.push(e);
  });
}

function makeEye(pal, type) {
  const want = floor(random(STRUCTS)), ty = TYPES[type];
  return { want, st: structs[want] ? want : 0, pal, off: floor(random(A)), type, ty,
    phase: random(100), breath: random(7, 12), speed: ty.speed * random(0.85, 1.15),
    pick: random(), face: -1,
    blinkAt: random(0.5, 4), blinkStart: -1, close: 0, red: random(0.3, 1),
    sc: random(0.65, 1.25), gath: 0, rot: 0, t3x: 0, t3y: 0, has: false, sx: 0, sy: 0, mvx: 0, mvy: 0, pace: random(1.0, 1.8), qNext: random(3), qEye: null, qx: 0, qy: 0, stirUntil: 0, vis: 1, goneUntil: 0, lx: random(-0.45, 0.45), ly: random(-0.45, 0.45),
    life: 0, age: 0, alpha: 1, dying: 0, ls: 1,
    sleep: 0, sleepDelay: random(0, 12), brave: random(), hide: 0, ear: random(), wakeAt: 0, hx: 0, hy: 0, jolt: random(0, 0.15),
    gx: 0, gy: 0, vx: 0, vy: 0, x: 0, y: 0, col: new Uint8ClampedArray(A * R * 3), buf: null, veins: null };
}

// recolour a structure with this eye's palette: ring colour x local brightness, highlights toward the fibre colour
function colourise(e, y0 = 0, y1 = R) {   // rows y0..y1, so a newborn's colours can be spread over a few frames
  const ratio = structs[e.st].ratio, ramp = e.pal.ramp, fib = e.pal.fibre, col = e.col;
  range(y1 - y0).forEach((yy) => {
    const y = y0 + yy;
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
      const shove = (1.05 - d) * 0.5, ux = dx / A / d, uy = dy / B / d;
      a.x -= ux * shove * A * 0.5; a.y -= uy * shove * B * 0.5; b.x += ux * shove * A * 0.5; b.y += uy * shove * B * 0.5;
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
  AI = new Int32Array(N * N); D = new Float32Array(N * N); SHADE = new Float32Array(N * N); ALPHA = new Uint8ClampedArray(N * N);
  const ins = [];
  range(N * N).forEach((i) => {
    const x = i % N, y = (i / N) | 0, dx = x - N / 2 + 0.5, dy = y - N / 2 + 0.5;
    const d = sqrt(dx * dx + dy * dy) / irisPx;
    D[i] = d;
    AI[i] = floor((atan2(dy, dx) / TWO_PI + 1) * A) % A;
    // shading that never changes: darker toward the top, a dark rim at the limbus, and the soft outer edge
    SHADE[i] = (1 - 0.22 * sstep(-0.2, -1, dy / irisPx)) * (1 - 0.45 * sstep(0.96, 1.03, d));
    ALPHA[i] = 255 * (1 - sstep(1.0, 1.1, d));
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
    * (1.15 - 0.45 * sstep(0.1, 0.7, light)) * (1 - 0.28 * e.close) * (1 + 0.3 * shock + 0.3 * pactWide);   // fright widens it, and so does the pact
  const aa = 1.5 / irisPx, P0 = PUPIL[0], P1 = PUPIL[1], P2 = PUPIL[2];
  inside.forEach((i) => {
    const d = D[i], ai = AI[i], pe = (pr - d) / aa, p = 4 * i;
    if (pe >= 1) { const sh = SHADE[i]; px[p] = P0 * sh; px[p + 1] = P1 * sh; px[p + 2] = P2 * sh; px[p + 3] = 255; return; }   // inside the pupil: nothing to light
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
    if (pe > -1) { const k = (pe + 1) / 2; r += (P0 - r) * k; g += (P1 - g) * k; b += (P2 - b) * k; }   // the pupil's soft edge
    const sh = SHADE[i];
    px[p] = r * sh; px[p + 1] = g * sh; px[p + 2] = b * sh; px[p + 3] = ALPHA[i];
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
  // each eye about 5 times a second (2 on a slow machine), at most 2 a frame however many eyes (pupils change
  // slowly); sleeping eyes are skipped
  rrAcc = min(2, rrAcc + EYES * (drawMs > 10 ? 2 : 5) * min(0.1, deltaTime / 1000));
  range(floor(rrAcc)).forEach(() => { const e = eyes[rr % EYES]; rr++; rrAcc--; if (e.sleep < 0.95) renderEye(e, t); });

  track();
  background(BG);
  const bs0 = cell * IRIS_IN_CELL / 0.9;     // on-screen size of an eye buffer (times each eye's size)
  drawingContext.imageSmoothingEnabled = true;
  const dt = min(0.1, deltaTime / 1000), steps = constrain(ceil(dt * 60 - 0.01), 1, 6), h = dt * 60 / steps;
  shock = 1 - sstep(0, 1.6, t - startle.at);   // 1 just after a startle, fading out
  const away = (millis() - seenAt) / 1000;
  creatureMoves(t, dt);
  storyStep(dt);
  pactStep(dt);
  farewellStep();
  lifeStep(dt);
  if (QUIET && t > stirNext) {   // asleep: now and then one of them half wakes, looks around, and goes back to sleep
    const asleep = eyes.filter((e) => e.sleep > 0.9);
    if (asleep.length) random(asleep).stirUntil = t + random(3, 6);
    stirNext = t + random(12, 25);
  }
  drawOrder.forEach((e) => {
    if (e.ready === false) return;   // a new eye still getting its colours
    const bs = bs0 * sz(e);
    // nobody there for a while: each eye gets drowsy and closes, one after another; awake again at once
    // (when someone arrives, each eye waits for the waking wave to reach it)
    if (STORY && faces.length) {   // the beast: frightened eyes shut tight; the shy ones peek half-closed from where they hide
      const want = millis() < e.hide ? 1 : min(1, 0.55 * constrain((e.brave - braveLine()) / 0.3, 0, 1)   // the next to dare open up first: you can see it listening
        + (companion ? 0 : 0.45 * heard * (1 - trust)));   // scared, a sound makes it squint
      const asleep = constrain(rest * 1.6 - e.ear * 0.6, 0, 1), goal = max(want, asleep);   // asleep beside you: one after another
      if (rest > 0.5 && t < e.stirUntil) e.sleep = max(0.25, e.sleep - dt * 2);   // now and then one opens a little to check on you
      else e.sleep += (goal - e.sleep) * min(1, dt * (goal > e.sleep ? (asleep > want ? 1.2 : 5) : 1.5));
    } else if (away > SLEEP_AFTER + e.sleepDelay) e.sleep = QUIET && t < e.stirUntil ? max(0, e.sleep - dt * 1.5) : min(1, e.sleep + dt / 5);
    else if (millis() >= e.wakeAt) e.sleep = max(0, e.sleep - dt * 3);
    if (e.dying) e.sleep = max(e.sleep, min(1, e.dying * 1.5));   // dying: its eye closes for the last time
    const gone = millis() < e.goneUntil;   // a loud sound: it vanishes into the dark at once, and comes back slowly
    e.vis += ((gone ? 0 : 1) - e.vis) * min(1, dt * (gone ? 10 : 0.7));
    // each eye rotates toward its own target, at its own speed (saccade-like)
    const g = gazeTarget(e, t, dt);
    // aim from a point between this eye and the screen centre: mostly parallel gaze, a little convergence
    const par = g.own ? 0 : lerp(PARALLEL, 0.4, e.gath);   // on the screen itself: from the eye; gathered round you: they converge a little
    const vx = g.x - lerp(e.x, width / 2, par), vy = g.y - lerp(e.y, height / 2, par), far = sqrt(vx * vx + vy * vy);
    const tth = min(radians(MAX_TURN), atan2(far, g.z)), tgx = far > 0 ? vx / far * tth : 0, tgy = far > 0 ? vy / far * tth * 0.75 : 0;   // eyes turn less up/down than sideways
    const dx = tgx - e.gx, dy = tgy - e.gy, err = sqrt(dx * dx + dy * dy);
    // moving like a real eye, but without steps: a critically damped spring (smooth speed, no overshoot) that is
    // soft while it follows you (pursuit) and much stiffer for a big change of target (a quick saccade)
    let w = err > 0.15 ? min(0.5, 0.2 + e.speed) * (0.5 + 0.5 * TEMPO) : 0.08 + e.speed * 0.25;   // following you stays quick
    if (shock > 0.4) w = 0.5; else if (e.sleep > 0.3) w *= 0.4;
    range(steps).forEach(() => {   // timed in 1/60 s units, so the eyes move at the same speed at any frame rate
      e.vx += h * (w * w * (tgx - e.gx) - 2 * w * e.vx); e.vy += h * (w * w * (tgy - e.gy) - 2 * w * e.vy);
      e.gx += h * e.vx; e.gy += h * e.vy;
    });
    e.close = lerp(e.close, e.watch ? 1 : e.face >= 0 && faces[e.face] ? faces[e.face].close : 0, 0.03);   // guarding: narrow, hard pupils
    // tilt: the eye's long axis turns toward the person it watches, so its look along it reads as a stare
    const pf = e.watch || (e.face >= 0 && faces[e.face]);
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
    // and wherever it looks, the whole eye turns part of the way with it, like a face does: the iris stays nearer
    // the middle of its opening instead of sliding to the corner of a flat, fixed socket
    const gf = FOLLOW * (1 - e.sleep);
    ux += e.gx * gf; uy += e.gy * gf;
    const um = sqrt(ux * ux + uy * uy), ucap = max(TURN, 0.7);
    if (um > ucap) { ux *= ucap / um; uy *= ucap / um; }
    e.t3x = lerp(e.t3x, ux, min(1, dt * 2.5)); e.t3y = lerp(e.t3y, uy, min(1, dt * 2.5));
    const turn = sqrt(e.t3x * e.t3x + e.t3y * e.t3y), tdir = atan2(e.t3y, e.t3x);
    const th = sqrt(e.gx * e.gx + e.gy * e.gy), dir = atan2(e.gy, e.gx) - e.rot, lphi = phi - e.rot;   // gaze and light in the eye's own (tilted) frame
    const ri = bs * 0.45, rb = 2 * ri, off = 2 * ri * sin(th) * (1 - 0.35 * gf);   // the turning eye carries part of the look
    e.ix = off * cos(dir);                      // the lids' highest points follow the iris sideways
    const L = lids(e, rb, t);
    const ctx = drawingContext;
    if (L.shut > 0.97 || e.vis < 0.02) return;   // closed, or hidden: nothing left in the dark
    ctx.save(); ctx.translate(e.x, e.y);
    const al = e.alpha * e.vis;
    ctx.globalAlpha = al;   // being born or dying, or hiding: it comes out of the dark, or goes back into it
    if (turn > 0.01) {   // turned: the opening slides a little toward where it faces (it sits on a ball) and its far side narrows
      ctx.translate(cos(tdir) * sin(turn) * rb * 0.3, sin(tdir) * sin(turn) * rb * 0.3);
      ctx.rotate(tdir); ctx.scale(cos(turn), 1); ctx.rotate(-tdir);
    }
    ctx.rotate(e.rot); ctx.translate(-e.x, -e.y);
    ctx.save();
    lidPath(ctx, e.x, e.y, L); ctx.clip();      // everything of the eye is seen through the lid opening
    sclera(e.x, e.y, rb, lphi);
    if (VEINS > 0) { if (!e.veins) e.veins = makeVeins(e); ctx.globalAlpha = VEINS * al; ctx.drawImage(e.veins.elt, e.x - rb, e.y - rb, 2 * rb, 2 * rb); ctx.globalAlpha = al; }
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
  narrate(min(0.1, deltaTime / 1000));   // over the eyes, so it can be read
  langSwitch();
  if (showCam) camView();
  else if (camStatus()) { noStroke(); fill(222, 214, 204, 60); textSize(12); textAlign(LEFT, BASELINE); text(camStatus(), 12, height - 12); }   // quietly, for whoever looks after it
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
    const p = e.face >= 0 && faces[e.face], here = p && e.has && e.sleep < 0.5 && AROUND && brave(e) && !e.dying;
    e.gath = lerp(e.gath, here ? 1 : 0, min(1, dt * 1.5));
    let tx = here ? e.sx : e.hx, ty = here ? e.sy : e.hy;   // its spot around you, or its own place in the scatter
    const still = pactT() < 4.5;   // the pact: they stay where they are until it is sealed
    if (here && STORY) { const j = 0.7 * jumpy(); tx += (tx - p.x) * j; ty += (ty - p.y) * j; }   // startled: it backs off a little, then comes back
    let run = 0;
    if (farewell && !faces.length && farewell.close && e.ear < 0.4 && farewellT() < 6) {   // the closest companions drift a little way after you
      const k = 0.45 * sstep(0, 2, farewellT()) * (1 - sstep(4, 6, farewellT()));
      tx = lerp(tx, farewell.x, k); ty = lerp(ty, farewell.y, k * 0.6);
    }
    if (still) { tx = e.x; ty = e.y; } else if (STORY && !here && faces.length) {   // not ready to come: it runs from you and leaves an empty space around you, wider the less it trusts you
      const q = faces[0], m = cell * 0.3, ax = tx - q.x, ay = ty - q.y, d = sqrt(ax * ax + ay * ay) || 1, ux = ax / d, uy = ay / d;
      run = constrain(SHY * (1 - trust) * (1 + 0.5 * MOOD * mood) * (1 + (1 - e.vis)), 0, 1.5);   // shyer on a day of frights; hidden, it slips further away
      // how far the screen goes in this direction, so the scatter is squeezed toward the edges, never piled on them
      const rx = ux > 0.01 ? (width - m - q.x) / ux : ux < -0.01 ? (q.x - m) / -ux : 1e9, ry = uy > 0.01 ? (height - m - q.y) / uy : uy < -0.01 ? (q.y - m) / -uy : 1e9;
      const rmax = max(cell, min(rx, ry)), gap = min(rmax * 0.85, width * 0.4 * run * (1 + 0.6 * (q.moving || 0)));   // the space opens wider while you move
      const nd = gap + min(d, rmax) * (rmax - gap) / rmax;
      tx = constrain(q.x + ux * nd, m, width - m); ty = constrain(q.y + uy * nd, m, height - m);
      run *= 1 + 2 * (q.moving || 0) + (d < gap ? 1 : 0);   // in a hurry while you move, or while it is still too close
    }
    if (shock > 0.3) {                      // startled: away from the sound or movement
      const ax = e.x - startle.x, ay = e.y - startle.y, d = sqrt(ax * ax + ay * ay) || 1;
      tx += ax / d * cell * 0.4 * shock; ty += ay / d * cell * 0.4 * shock;
    }
    const wob = cell * lerp(0.12, 0.03, e.gath);   // held still while they watch you
    tx += (noise(t * 0.15, e.phase) - 0.5) * wob; ty += (noise(e.phase, t * 0.15) - 0.5) * wob;
    if (STORY && !here && faces.length && !companion) {   // afraid: it trembles, more while you move
      const tr = cell * 0.1 * SHY * (1 - trust) * (1 + 2 * (faces[0].moving || 0));
      tx += (noise(t * 2.5, e.phase) - 0.5) * tr; ty += (noise(e.phase, t * 2.5) - 0.5) * tr;
    }
    // glide there, each eye at its own pace, curving around your face
    const w = e.pace * SNAP * (t < e.rushUntil ? 2 : 1) * (1 + 0.7 * min(run, 2)), steps = constrain(ceil(dt * 60), 1, 6), h = dt / steps;   // hurrying to greet you
    range(steps).forEach(() => {
      let ax = w * w * (tx - e.x) - 2 * w * e.mvx, ay = w * w * (ty - e.y) - 2 * w * e.mvy;   // critically damped: glide in and settle, no overshoot
      faces.forEach((q) => {   // keep off every face: pushed out to the side, so paths bend around it
        const dx = e.x - q.x, dy = (e.y - q.y) * 1.3, d = sqrt(dx * dx + dy * dy) || 1, r = cell * AROUND_HOLE * 1.1 * (1 + GROW * grow * 0.6);
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
    const group = eyes.filter((e) => e.face === fi && e.sleep < 0.5 && brave(e));
    if (!group.length) return;
    const big = 1 + GROW * grow, slots = [], gap = cell * 0.9 * big;   // grown eyes need wider rings
    const st = STORY && companion && fi === 0 && stranger(), wall = st && { x: (st.x - p.x) / (dist(st.x, st.y, p.x, p.y) || 1), y: (st.y - p.y) / (dist(st.x, st.y, p.x, p.y) || 1) };
    range(8).forEach((k) => {
      if (slots.length >= group.length * 1.5) return;
      const rx = cell * (AROUND_HOLE * big + (1 - trust) * 3.2 + 0.62 * k * big) * 1.1,   // the less it trusts you, the wider it circles
        ry = rx * 0.7, n = max(5, floor(TWO_PI * sqrt((rx * rx + ry * ry) / 2) / gap));
      range(n).forEach((i) => {
        const a = (i + 0.5 * (k % 2)) / n * TWO_PI, x = p.x + cos(a) * rx, y = p.y + sin(a) * ry;
        if (x > cell * 0.3 && x < width - cell * 0.3 && y > cell * 0.25 && y < height - cell * 0.25) slots.push({ x, y, k });
      });
    });
    const pairs = [];
    group.forEach((e) => slots.forEach((sl, j) => {
      let c = sqrt(sq(sl.x - e.x) + sq(sl.y - e.y)) + sl.k * cell * 3;   // inner ring first, even if it is a longer trip
      if (e.sxPrev !== undefined && sq(sl.x - e.sx) + sq(sl.y - e.sy) < sq(gap * 0.6)) c -= gap * 0.8;   // keep its spot
      if (wall) c -= ((sl.x - p.x) * wall.x + (sl.y - p.y) * wall.y) / (sqrt(sq(sl.x - p.x) + sq(sl.y - p.y)) || 1) * cell * 3;   // guarding: between you and the stranger
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
    const A = 0.92 * bs * (sz(a) + sz(b)), B = 0.6 * bs * (sz(a) + sz(b));
    const dx = b.x - a.x, dy = b.y - a.y, d = sqrt(sq(dx / A) + sq(dy / B));
    if (d >= 1 || d === 0) return;
    const shove = (1 - d) * 0.25, ux = dx / A / d, uy = dy / B / d;
    a.x -= ux * shove * A; a.y -= uy * shove * B; b.x += ux * shove * A; b.y += uy * shove * B;
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
    // the room: an echo made here (noise that dies away over about 3 s, darker as it fades); the low tone stays dry
    // everything it plays goes through one bus to the speakers; its "ear" on that bus knows what it is saying,
    // so the microphone can leave it out (ownHeard), and a video can record it
    const v = { ac, noise: buf, verbIn: null, master: ac.createGain(), ear: ac.createAnalyser() };
    v.ear.fftSize = 512; v.earBuf = new Float32Array(512);
    v.master.connect(v.ear); v.ear.connect(ac.destination);
    if (REVERB > 0 && ac.createConvolver) {
      const cv = ac.createConvolver(), hp = ac.createBiquadFilter();
      cv.buffer = makeRoom(ac); hp.type = 'highpass'; hp.frequency.value = 140;   // no boom from the low sounds
      v.verbIn = ac.createGain(); v.verbIn.gain.value = REVERB;
      v.verbIn.connect(hp); hp.connect(cv); cv.connect(v.master);
    }
    src.connect(lp); lp.connect(g); osc.connect(og); og.connect(v.master);
    const bp = spot(v, g, 0.3);   // the breath: where the eyes are
    // the hum: two soft tones a fifth apart, slightly detuned so they beat slowly, through a warm filter
    const h1 = ac.createOscillator(), h2 = ac.createOscillator(), hl = ac.createBiquadFilter(), hg = ac.createGain();
    h1.type = 'triangle'; h1.frequency.value = 98; h2.type = 'sine'; h2.frequency.value = 147.7;
    hl.type = 'lowpass'; hl.frequency.value = 420; hg.gain.value = 0;
    h1.connect(hl); h2.connect(hl); hl.connect(hg);
    const hp = spot(v, hg, 0.45);   // the hum: around you
    src.start(); osc.start(); h1.start(); h2.start();
    voice = Object.assign(v, { lp, g, og, osc, hg, bp, hp, phase: 0, gaspUntil: 0 });
  } catch (e) { console.warn('no sound:', e); }
}
// a large dark room's echo: noise that dies away (about 3 s), bright at first and darker as it fades, a little
// different in each ear. forEach, not a for loop: the p5 editor's loop protection
function makeRoom(ac) {
  const sr = ac.sampleRate, ir = ac.createBuffer(2, floor(sr * 3.2), sr);
  [0, 1].forEach((ch) => {
    const d = ir.getChannelData(ch);
    let lo = 0;
    d.forEach((_, i) => {
      const t = i / sr, a = 0.85 * Math.exp(-t * 2.5) + 0.04;   // how bright: less and less
      lo += a * (Math.random() * 2 - 1 - lo);
      d[i] = t < 0.02 ? 0 : lo * Math.exp(-t * 2.2);            // a moment of silence, then the room answers
    });
  });
  return ir;
}
// a place for a sound: left or right (stereo), and how much of it reaches the room's echo
function spot(v, node, wet, x) {
  const p = v.ac.createStereoPanner ? v.ac.createStereoPanner() : v.ac.createGain();
  node.connect(p); p.connect(v.master);
  if (p.pan && x !== undefined) p.pan.value = panAt(x);
  if (v.verbIn && wet > 0) { const s = v.ac.createGain(); s.gain.value = wet; p.connect(s); s.connect(v.verbIn); }
  return p;
}
const panAt = (x) => (STEREO ? constrain(x / width * 2 - 1, -1, 1) * 0.85 : 0);   // screen left = left speaker
function panTo(p, x, now, slow) { if (p && p.pan) p.pan.setTargetAtTime(panAt(x), now, slow); }

// frightened: one sharp breath in, then a shaky breath out, from where the fright came
function gasp(k = 1, x) {
  if (!GASP || !voice || voice.ac.state !== 'running') return;
  const t = voice.ac.currentTime, g = voice.g.gain, f = voice.lp.frequency;
  g.cancelScheduledValues(t); f.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.42 * k, t + 0.07); g.setTargetAtTime(0.04, t + 0.12, 0.22);
  f.setValueAtTime(f.value, t); f.linearRampToValueAtTime(2600, t + 0.06); f.setTargetAtTime(380, t + 0.12, 0.25);
  if (x !== undefined && voice.bp.pan) { voice.bp.pan.cancelScheduledValues(t); voice.bp.pan.setTargetAtTime(panAt(x), t, 0.02); }
  voice.gaspUntil = t + 0.9; voice.phase = 0.6;   // the breathing then goes on from a breath out
}

// ---------- voices of the souls ----------
// Each eye has small sounds of its own: a soft bing in its note when it blinks open-eyed (louder near you), a faint note
// when it is born, and a whisper with its note sinking away when it dies. Bigger eyes have lower notes (G minor
// pentatonic, above the hum's G and D). Blinks are rationed, so many eyes never clatter.
const NOTES = [392, 466.2, 523.3, 587.3, 698.5, 784];
const soulNote = (e) => NOTES[constrain(floor((1.25 - e.sc) / 0.6 * NOTES.length), 0, NOTES.length - 1)];
let clicks = 3;
function soulSound(kind, e) {
  const v = voice;
  if (VOICES <= 0 || !v || v.ac.state !== 'running') return;
  const ac = v.ac, t = ac.currentTime;
  if (kind === 'blink') {
    if (clicks < 1 || e.sleep > 0.5 || e.vis < 0.5 || e.alpha < 0.5) return;
    clicks--;
    // a soft, clear "bing" in its own note, an octave up: a gentle start (no knock) and a ringing fade into the room
    const f0 = soulNote(e) * 2, o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain(), g = ac.createGain(), at = t + (e.blinkDur || e.ty.dur) * 0.3;   // when the lids meet
    o1.frequency.value = f0; o2.frequency.value = f0 * 2.002; g2.gain.value = 0.12;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(VOICES * (0.025 + 0.045 * e.gath), at + 0.006); g.gain.setTargetAtTime(0, at + 0.01, 0.16);
    spot(v, g, 0.5, e.x);
    o1.start(at); o2.start(at); o1.stop(at + 1.4); o2.stop(at + 1.4);
  } else if (kind === 'born') {   // its note, a glassy tone that swells and fades as it appears
    const f0 = soulNote(e), o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain(), g = ac.createGain();
    o1.frequency.value = f0; o2.frequency.value = f0 * 2.003; g2.gain.value = 0.2;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(VOICES * 0.022, t + 1.2); g.gain.setTargetAtTime(0, t + 1.4, 1.1);
    spot(v, g, 0.9, e.x);
    o1.start(t); o2.start(t); o1.stop(t + 7); o2.stop(t + 7);
  } else if (kind === 'die') {    // a whisper: breathy noise in a narrow band sinking from high to low, in soft pulses
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), am = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
    src.buffer = v.noise; src.loop = true; f.type = 'bandpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(450, t + 3.2);
    lfo.frequency.value = 3.2; depth.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(depth); depth.connect(am.gain);
    src.connect(f); f.connect(am); am.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(VOICES * 0.16, t + 0.5); g.gain.setTargetAtTime(0, t + 1.2, 0.8);
    spot(v, g, 0.7, e.x);
    const o = ac.createOscillator(), og = ac.createGain(), f0 = soulNote(e);   // and its note, sinking a little and fading
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.89, t + 4);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(VOICES * 0.02, t + 0.6); og.gain.setTargetAtTime(0, t + 1, 1.2);
    o.connect(og); spot(v, og, 0.9, e.x);
    src.start(t); lfo.start(t); o.start(t); src.stop(t + 6); lfo.stop(t + 6); o.stop(t + 6);
  }
}
// a soul passing near the others: they notice
let mournAt = -1e9;
const mournDip = () => (MOURN ? 1 - sstep(0, 2.5, (millis() - mournAt) / 1000) : 0);
function mourn(d) {
  if (!MOURN) return;
  const t = millis() / 1000;
  eyes.filter((o) => o !== d && !o.dying && o.sleep < 0.6)
    .sort((a, b) => sq(a.x - d.x) + sq(a.y - d.y) - sq(b.x - d.x) - sq(b.y - d.y)).slice(0, 6)
    .forEach((o, i) => { o.mournUntil = t + 2.2 + i * 0.15; o.mournAt = t + i * 0.15; o.mournX = d.x; o.mournY = d.y; });   // nearest first
  if (faces.length) mournAt = millis();   // with someone there, its breath catches for a moment
}

function breathe(dt) {
  if (!voice || voice.ac.state !== 'running') return;
  const now0 = voice.ac.currentTime;
  // the hum: while it is gathered round you (grown), swelling a little with each breath; gone when it sleeps or is afraid
  if (HUM) voice.hg.gain.setTargetAtTime(STORY && companion && faces.length ? 0.035 * grow * (1 - 0.8 * rest) * (0.7 + 0.3 * sin(TWO_PI * voice.phase)) : 0, now0, 0.5);
  const you = faces[0];
  panTo(voice.hp, you ? lerp(width / 2, you.x, 0.6) : width / 2, now0, 0.6);   // the hum is round you
  clicks = min(3, clicks + dt * 2.5);   // about two blink sounds a second at most
  if (now0 < voice.gaspUntil) return;   // a gasp is playing
  panTo(voice.bp, you ? lerp(width / 2, you.x, 0.5) : width / 2, now0, 1.2);   // its breath: where it is gathered
  let awake = 0, watching = 0, near = 0, moving = 0;
  eyes.forEach((e) => {
    awake += 1 - e.sleep; if (e.face >= 0 && e.sleep < 0.5) watching++;
    near += e.gath; moving += sqrt(e.mvx * e.mvx + e.mvy * e.mvy);
  });
  awake /= eyes.length; watching /= eyes.length; near /= eyes.length; moving /= eyes.length;
  // gathered round you and settled: it holds its breath while it stares (and lets it go as you leave)
  voice.stare = lerp(voice.stare || 0, near * (1 - constrain(moving / (cell * 0.4), 0, 1)), min(1, dt * 0.8));
  const hold = voice.stare;
  const fear = (STORY && faces.length ? 1.6 - 0.7 * trust : 1) * (1 - 0.5 * rest);   // the beast: quick, shallow breaths while it is afraid; slow and deep asleep
  voice.phase += dt * fear * (0.1 + 0.15 * awake + 0.12 * near * (1 - hold) + 0.3 * shock) * (1 - 0.75 * hold);   // breaths per second
  const s = sin(TWO_PI * voice.phase), env0 = s > 0 ? pow(s, 1.5) : 0.35 * pow(-s, 2);   // in-breath stronger than out
  const env = lerp(env0, 0.35 + 0.12 * env0, hold * (1 - rest)) * (1 - 0.6 * mournDip());   // held: a quiet, almost still breath (not asleep); a soul passing: it catches its breath
  const hid = 1 - eyes.reduce((a, e) => a + e.vis, 0) / eyes.length;   // hidden from a loud sound: it hardly dares breathe
  const now = voice.ac.currentTime, loud = (0.05 + 0.07 * watching + 0.1 * near + 0.1 * shock + 0.08 * grow) * (1 - 0.8 * hid);   // closer = louder
  voice.g.gain.setTargetAtTime(env * loud, now, 0.08);
  voice.lp.frequency.setTargetAtTime((200 + 650 * env * (0.5 + watching)) * (1 - 0.35 * near), now, 0.08);   // closer = warmer, darker
  voice.og.gain.setTargetAtTime(0.015 + 0.035 * watching + 0.04 * near, now, 0.4);   // and more body underneath
  voice.osc.frequency.setTargetAtTime(44 + 8 * watching - 6 * near + 20 * shock, now, 0.4);
  const pt = pactT();
  if (pt >= 0 && pt < 5.5) {   // the pact: it holds its breath, then one long deep breath as the eyes open
    const b = pt < 1.2 ? 0 : sin(PI * constrain((pt - 1.2) / 4.2, 0, 1)), d = pow(b, 1.3);
    voice.g.gain.setTargetAtTime(0.01 + 0.4 * d, now, 0.15);
    voice.lp.frequency.setTargetAtTime(160 + 700 * d, now, 0.15);
    voice.og.gain.setTargetAtTime(0.03 + 0.1 * d, now, 0.3);
    voice.osc.frequency.setTargetAtTime(36 + 6 * d, now, 0.4);
    voice.phase = 0.75;   // and the usual breathing starts again from a pause
  }
  const ft = farewellT();
  if (ft > 2.5 && ft < 8 && !faces.length) {   // its friend has gone: one long breath out
    const u = constrain((ft - 2.5) / 5.5, 0, 1), d = sstep(0, 0.15, u) * pow(1 - u, 1.6);
    voice.g.gain.setTargetAtTime(0.02 + 0.3 * d, now, 0.2);
    voice.lp.frequency.setTargetAtTime(180 + 500 * d, now, 0.2);
    voice.osc.frequency.setTargetAtTime(38 + 4 * d, now, 0.4);
    voice.phase = 0.75;
  }
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
  // with several people each eye picks one; the beast belongs to one person (its friend, always faces[0])
  e.face = !faces.length ? -1 : STORY ? 0 : min(faces.length - 1, floor(e.pick * faces.length));
  e.watch = STORY ? guardOf(e) : null;
  // startled: everyone snaps toward the sound or movement (each a split second apart)
  if (t - startle.at > e.jolt && t - startle.at < 1 + e.jolt) return { x: startle.x, y: startle.y, z: width * FACE_DIST * 0.8 };
  // someone new arrived: for a moment all eyes turn to them
  if (newcomer && millis() < newcomer.until && faces.includes(newcomer.p)) return delayed(newcomer.p, e);
  if (e.mournUntil > t && t > e.mournAt && !e.watch) return { x: e.mournX, y: e.mournY, z: cell * 1.2, own: true };   // a soul is passing: it looks
  if (STORY && !faces.length && farewellT() < 7) return { x: farewell.x + (e.lx || 0) * cell, y: farewell.y + (e.ly || 0) * cell, z: width * FACE_DIST };   // watching you go
  if (QUIET && !faces.length) return quietGaze(e, t);
  if (e.watch) return delayed(e.watch, e);   // guarding you: it stares the stranger down
  if (STORY && faces.length && !companion && !brave(e)) { const g = shyGaze(e, t); if (g) return g; }
  if (STORY && faces.length) { const g = watchGaze(e, t); if (g) return g; }
  const who = e.face >= 0 ? faces[e.face] : focus;
  return delayed(who, e);
}

// nobody there: each eye looks at a neighbour or lets its gaze drift; a neighbour sometimes looks back and blinks
// Listening for danger: it hears before it sees. A sound sets some eyes searching, darting from spot to spot,
// more eyes and faster the louder it is; in silence they calm down again (asleep, a sound half wakes a few)
let heard = 0;
// rhythm: on each sudden sound, every eye that is awake and searching jumps to a new spot at the same moment
// (a few sleeping ones half wake); with music they dart together on the beat
function onBeat() {
  const t = millis() / 1000;
  heard = max(heard, 0.3);
  if (faces.length) {   // someone is here: scared, it flinches; your companion, its watchers turn out together
    if (STORY) eyes.forEach((e) => {
      if (companion) { if (e.ear < 0.5) { e.wUntil = t + random(0.5, 0.9); e.wNext = e.wUntil; watchSpot(e); } }
      else if (random() < 0.6) e.blinkAt = min(e.blinkAt, t + random(0, 0.08));
    });
    if (STORY && !companion) addTrust(-0.04, 'a sharp sound');   // each clap or bang costs a little
    return;
  }
  eyes.forEach((e) => {
    if (e.sleep > 0.8) { if (random() < 0.2) e.stirUntil = t + random(1, 2.5); return; }
    e.qEye = null; e.qx = random(0.05, 0.95) * width; e.qy = random(0.1, 0.9) * height;
    e.qNext = t + random(0.4, 0.9);   // hold the new look a moment, so the jump reads as one movement
  });
}
// someone is here and it hears something. Scared: its eyes glance round nervously, away from you (and it won't
// trust you while it's noisy, so quiet earns trust too). Your companion: it keeps watch for you; about half
// the eyes turn out to search the room, the rest stay on you, then they come back
function watchGaze(e, t) {
  const share = companion ? 0.5 : 1;
  if (!(t < e.wUntil) && (heard < 0.05 || e.ear > heard * 1.3 * share)) return null;
  if (!(t < e.wNext)) {
    e.wNext = t + lerp(random(0.8, 1.6), random(0.2, 0.5), heard);
    watchSpot(e);
  }
  return { x: e.wx, y: e.wy, z: width * FACE_DIST * 1.5 };
}
// afraid: it can't hold your gaze. It looks away, out of the corner of its eye, and now and then steals a quick
// look at you; the more it trusts you, the longer and more often it looks
function shyGaze(e, t) {
  const p = faces[0];
  if (!(t < e.avNext)) {
    e.peek = random() < 0.25 + 0.5 * trust;
    e.avNext = t + (e.peek ? random(0.6, 1.2) + trust : random(1.5, 3.5) * (1 - 0.5 * trust)) / TEMPO;
    if (!e.peek) {   // away: past itself, on the far side from you
      const ax = e.x - p.x, ay = e.y - p.y, d = sqrt(ax * ax + ay * ay) || 1, a = atan2(ay, ax) + random(-0.7, 0.7);
      e.avx = constrain(e.x + cos(a) * width * 0.5, 0, width); e.avy = constrain(e.y + sin(a) * height * 0.5, 0, height);
    }
  }
  return e.peek ? null : { x: e.avx, y: e.avy, z: width * FACE_DIST };
}
// a spot out in the room, away from you (scared, it looks anywhere but at you; your companion watches the room for you)
function watchSpot(e) {
  const p = faces[0];
  let best = -1;
  range(4).forEach(() => {
    const x = random(0.05, 0.95) * width, y = random(0.1, 0.9) * height, d = p ? sq(x - p.x) + sq(y - p.y) : 1;
    if (d > best) { best = d; e.wx = x; e.wy = y; }
  });
}
function quietGaze(e, t) {
  const a = e.ear < heard * 1.3 ? heard : 0;
  if (a > 0.05 && e.sleep > 0.8 && t > e.stirUntil) e.stirUntil = t + random(1.5, 3);
  if (a > 0.05 && e.qNext - t > lerp(2, 0.9, a)) e.qNext = t + random(0, 0.3);   // a new sound cuts a long look short
  if (t > e.qNext) {
    e.qNext = t + lerp(random(2, 6), random(0.15, 0.5), a);
    e.qEye = null;
    if (a > 0.05) { e.qx = random(0.05, 0.95) * width; e.qy = random(0.1, 0.9) * height; }   // searching
    else if (random() < 0.5) {
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
  if (e.blinkStart < 0 && t >= e.blinkAt) { e.blinkStart = t; soulSound('blink', e); }
  let c = 0;
  if (e.blinkStart >= 0) {
    const u = (t - e.blinkStart) / (e.blinkDur || e.ty.dur);
    if (u >= 1) { e.blinkStart = -1; e.blinkDur = 0; e.blinkAt = t + random(e.ty.blink[0], e.ty.blink[1]) * (random() < 0.15 ? 0.1 : 1); }   // sometimes a double blink
    else c = u < 0.35 ? sstep(0, 0.35, u) : 1 - sstep(0.35, 1, u);
  }
  if (e.sleep > 0) c = max(c, e.sleep >= 1 ? 1 : e.sleep * (0.75 + 0.25 * noise(t * 0.6, e.phase)));   // drowsy lids sag and flutter
  const vg = constrain((e.gy * cos(e.rot) - e.gx * sin(e.rot)) / radians(MAX_TURN), -1, 1), open = e.ty.lid * (1 + 0.3 * shock + 0.3 * pactWide + (companion && faces.length ? 0.15 * heard : 0) + (e.watch ? 0.2 : 0));   // wide open when startled; alert when your companion hears something
  let up = e.y - rb * (0.5 - 0.35 * vg) * open, lo = e.y + rb * (0.42 + 0.18 * vg);
  const meet = lerp(up, lo, 0.75);
  up = lerp(up, meet, c); lo = lerp(lo, meet, c);
  // quadratic control points that make each curve pass through its apex
  const ix = e.ix || 0;
  return { xl: e.x - rb * 0.98, xr: e.x + rb * 0.98, cu: 2 * up - e.y, cl: 2 * lo - e.y, ux: e.x + ix * 0.75, lx: e.x + ix * 0.45, open, shut: c };
}

function lidPath(ctx, cx, cy, L) {
  ctx.beginPath(); ctx.moveTo(L.xl, cy);
  ctx.quadraticCurveTo(L.ux, L.cu, L.xr, cy); ctx.quadraticCurveTo(L.lx, L.cl, L.xl, cy);
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

function openCamera() {
  cam = createCapture(VIDEO);
  cam.size(320, 240);
  // keep the video "on the page" but invisible: a hidden (display: none) video is not refreshed by some
  // browsers (iPhone Safari especially), so the face search would keep looking at an old frame
  cam.elt.setAttribute('playsinline', ''); cam.elt.muted = true;
  cam.style('position', 'fixed'); cam.style('left', '0'); cam.style('top', '0');
  cam.style('width', '2px'); cam.style('height', '2px'); cam.style('opacity', '0.01'); cam.style('pointer-events', 'none');
}
async function startTracking() {
  try {
    openCamera();
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
    let used = PHONE || (BLINK_BACK && !Q.has('gpu')) ? 'GPU' : DELEGATE;   // phones run the face search much faster on their graphics chip
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
    trackFail = true;
  }
}

// one detection: a list of faces as { fx, fy, w } (0..1 of the camera image) and, with landmarks, how shut the eyes are
// which part of the camera image to search: the whole frame, or a 2x zoom. The face model only finds faces
// up to about 2 m in the whole frame, so when it finds nobody the next looks sweep zoomed left, centre and right,
// and a zoom follows people who are only found that way (every 4th look still checks the whole frame).
const WHOLE = { x: 0, y: 0, s: 1 }, HUNT = [{ x: 0.25, y: 0.2, s: 0.5 }, { x: 0, y: 0.2, s: 0.5 }, { x: 0.5, y: 0.2, s: 0.5 }];
let zoom = null, hunt = 0, detN = 0, lastFound = [], lastCrop = WHOLE, showCam = false;

function detectFaces(v) {
  const vw = v.videoWidth || 640, vh = v.videoHeight || 480, port = vh > vw;   // phones in portrait give a tall image
  const L = BLINK_BACK ? 320 : 160, S = L * 3 / 4, SW = port ? S : L, SH = port ? L : S;
  const wk = port ? vw / vh : 1;   // face width as a fraction of the long side, so distance reads the same both ways
  const c = zoom && ++detN % 4 ? zoom : WHOLE;
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
      // 1 = nose tip: how far it sits off the middle of the face says how far you have turned your head away
      return { fx: (lm[234].x + lm[454].x) / 2, fy: lm[168].y, w: abs(lm[454].x - lm[234].x) * wk, shut, yaw: (lm[1].x - (lm[234].x + lm[454].x) / 2) / max(0.01, abs(lm[454].x - lm[234].x)) };
    });
  }
  // back to whole-frame coordinates
  found.forEach((f) => { f.fx = c.x + f.fx * c.s; f.fy = c.y + f.fy * c.s; f.w *= c.s; });   // (w stays in long-side units)
  const zoomOn = (fs) => {
    let mx = 0, my = 0;
    fs.forEach((f) => { mx += f.fx / fs.length; my += f.fy / fs.length; });
    return { x: constrain(mx - 0.25, 0, 0.5), y: constrain(my - 0.25, 0, 0.5), s: 0.5, track: true };
  };
  if (c === WHOLE) {
    if (found.length) zoom = found.every((f) => f.w < 0.1) ? zoomOn(found) : null;   // everyone small = far: zoom in on them
    else if (!zoom || !zoom.track) zoom = HUNT[hunt++ % 3];                       // nobody: search zoomed next
  } else if (found.length) zoom = zoomOn(found);                                   // keep the zoom on them as they move
  else zoom = HUNT[hunt++ % 3];
  lastCrop = c; lastFound = found;
  return found;
}

// what is wrong, if anything: no camera, or the face search couldn't load (no internet on the first start)
function camStatus() {
  if (trackFail) return 'face search not loaded (no internet?)';
  if (millis() - startMs > 10000 && !camWorked) return 'no camera';
  return '';
}

// D key: the camera image (mirrored, like a mirror) with the faces found and the area searched
function camView() {
  const v = cam && cam.elt, W = min(200, width * 0.45), X = width - W - 12;
  const H = v && v.readyState >= 2 ? W * (v.videoHeight || 3) / (v.videoWidth || 4) : 0, Y = 12, ctx = drawingContext;
  // the machine: smooth enough? how many eyes, how long one face search takes, and the day's mood
  noStroke(); fill(255); textSize(12); textAlign(RIGHT, BASELINE);
  text(round(fpsAvg) + ' fps · ' + EYES + ' eyes · face search ' + round(detMs) + ' ms' + (STORY && MOOD ? ' · mood ' + (mood > 0.05 ? 'wary ' : mood < -0.05 ? 'bold ' : '') + mood.toFixed(2) : ''), width - 12, Y + H + 70);
  textAlign(LEFT, BASELINE);
  if (!H) { text(camStatus() || 'camera starting', X, Y + 16); return; }
  ctx.save(); ctx.translate(X + W, Y); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
  noFill(); strokeWeight(1);
  stroke(255, 200, 0); rect(X + (1 - lastCrop.x - lastCrop.s) * W, Y + lastCrop.y * H, lastCrop.s * W, lastCrop.s * H);
  stroke(0, 255, 120);
  lastFound.forEach((f) => rect(X + (1 - f.fx - f.w / 2) * W, Y + f.fy * H - f.w * W / 2, f.w * W, f.w * W));
  noStroke(); fill(255); textSize(12);
  text(faces.length + (faces.length === 1 ? ' person' : ' people') + (lastCrop.s < 1 ? ' (zoomed search)' : ''), X, Y + H + 16);
  if (STORY) {   // the beast's trust, and the last thing it read in you
    noFill(); stroke(255, 120); rect(X, Y + H + 26, W, 6); noStroke(); fill(255, 200, 120); rect(X, Y + H + 26, W * trust, 6);
    fill(255); text('trust ' + trust.toFixed(2) + (companion ? ' · companion' + (grow > 0.05 ? ', grown ' + round(100 * GROW * grow) + '%' : '') : '') + (millis() - trustNoteAt < 4000 ? ' · ' + trustNote : '') + (companion && stranger() ? ' · guarding you' : '') + (rest > 0.05 ? ' · asleep ' + round(rest * 100) + '%' : '') + (mem ? ' · remembers someone, ' + ceil(REMEMBER - (millis() - mem.at) / 1000) + ' s' : ''), X, Y + H + 50);
  }
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
  if (STORY) { fright(0.25, 'a loud sound', true); return; }
  eyes.forEach((e) => { e.sleep = 0; e.blinkStart = -1; e.blinkAt = startle.at + random(1.2, 2.5); });
  console.log('startle');
}

// microphone level (Web Audio, nothing recorded or sent); a sound much louder than the room startles
async function startMic() {
  try {
    // no noise suppression or automatic volume: they flatten claps, steps and beats (echo cancellation stays, so it doesn't hear its own breath)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const an = ac.createAnalyser(), mute = ac.createGain();
    an.fftSize = 512; mute.gain.value = 0;
    ac.createMediaStreamSource(stream).connect(an); an.connect(mute); mute.connect(ac.destination);
    mic = { ac, an, buf: new Float32Array(512), base: 0.01, recent: 0.01, hitAt: 0 };
    console.log('sound startle on' + (ac.state === 'running' ? '' : ' (click or press a key once to arm it)'));
  } catch (e) {
    console.warn('sound startle off:', e);
  }
}

function listen() {
  heard *= pow(0.4, min(0.1, deltaTime / 1000));   // what it heard fades over a few seconds
  if (!mic || mic.ac.state !== 'running') return;
  mic.an.getFloatTimeDomainData(mic.buf);
  let s = 0;
  mic.buf.forEach((v) => { s += v * v; });
  const rms = ownLeftOut(s / 512);   // what it hears, without its own voice
  // any sound above the room's own hum: the eyes hear something (0..1), and it fades over a few seconds
  const now = max(0, min(1, (rms / max(0.003, mic.base) - 1.8) / 5));
  heard = max(heard, now);
  // a sudden sound: much louder than a moment ago, and well above the room
  if (RHYTHM && rms > mic.recent * 1.8 && rms > max(0.01, mic.base * 2.5) && millis() - mic.hitAt > 150) { mic.hitAt = millis(); own.skip = millis() + 1500; onBeat(); }
  mic.recent = lerp(mic.recent, rms, 0.3);
  if (rms > max(0.035, mic.base * SOUND_LEVEL)) {   // loud: look out at whoever is there, or straight ahead
    const f = faces[0];
    own.skip = millis() + 3000;
    startleAt(f ? f.x : width / 2, f ? f.y : height / 2);
  } else mic.base = lerp(mic.base, rms, now > 0 ? 0.002 : 0.02);   // a voice or steps don't become the new quiet
}

// Not hearing itself. Its breath, gasps and bings come out of the speakers and could reach the microphone (echo
// cancellation usually removes them, but not on every machine). So it learns how much of its own sound reaches
// the microphone: over the last half minute, how far the microphone's loudness rises with what it is playing
// (a room's own sounds don't rise and fall with its voice, so they don't count). That part is taken away before
// it listens. If none of its sound reaches the microphone, it learns 0 and nothing changes. Not learned while it
// is reacting to a sound (it breathes harder then, which would look like hearing itself).
const own = { hist: [], mx: 0, my: 0, cxy: 0, vxx: 0, k: 0, skip: 0 };
function ownLeftOut(micPow) {
  let p = 0;
  if (voice && voice.ear && voice.ac.state === 'running') { voice.ear.getFloatTimeDomainData(voice.earBuf); voice.earBuf.forEach((x) => { p += x * x; }); p /= 512; }
  own.hist.push(p); if (own.hist.length > 15) own.hist.shift();   // the last quarter second: the way to the microphone takes a moment
  const x = Math.max(...own.hist);
  if (millis() > own.skip && shock < 0.05) {
    const a = min(1, deltaTime / 30000);
    own.mx += a * (x - own.mx); own.my += a * (micPow - own.my);
    own.cxy += a * ((x - own.mx) * (micPow - own.my) - own.cxy); own.vxx += a * (sq(x - own.mx) - own.vxx);
    own.k = own.vxx > 1e-12 ? constrain(own.cxy / own.vxx, 0, 50) : 0;
  }
  return sqrt(max(micPow * 0.1, micPow - own.k * x));   // never more than 90% taken away
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
  const blendK = (cut, dt) => { const r = TWO_PI * cut * dt; return r / (r + 1); };
  return {
    x: () => x, v: () => dx,
    f: (val, t) => {
      if (x === null) { x = val; tp = t; return x; }
      const dt = max(0.001, t - tp); tp = t;
      dx += blendK(1, dt) * ((val - x) / dt - dx);
      x += blendK(minCut + beta * abs(dx), dt) * (val - x);
      return x;
    },
  };
}

let trackFail = false, detMs = 10, rvfc = false, lightN = 0, fpsTarget = 60, curRate = 60, lowCount = 0, drops = 0, droppedAt = 0, drawMs = 5;
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
    let p = null, bd = 0;
    faces.forEach((o) => { if (matched.includes(o)) return; const d = sqrt(sq(o.fx.x() - f.fx) + sq(o.fy.x() - f.fy)), r = max(0.2, 1.5 * o.w.x()); if (d < r && (!p || d < bd)) { bd = d; p = o; } });   // close to the camera a head moves further
    if (!p) {   // someone the camera lost a moment ago, found again somewhere else: the same person, not a newcomer (keeps its trust)
      const lost = faces.filter((o) => !matched.includes(o) && now - o.lastSeen > 250 && sqrt(sq(o.fx.x() - f.fx) + sq(o.fy.x() - f.fy)) < 0.5 && !found.some((g) => g !== f && sqrt(sq(o.fx.x() - g.fx) + sq(o.fy.x() - g.fy)) < max(0.2, 1.5 * o.w.x())));
      if (lost.length) { p = lost[0]; p.fx = euro(0.3, 1); p.fy = euro(0.3, 1); p.w = euro(0.5, 1); p.jumpAt = now; }
    }
    if (!p) {
      if (faces.length >= MAX_FACES) return;
      p = { fx: euro(0.3, 1), fy: euro(0.3, 1), w: euro(0.5, 1), since: now, wasShut: false, close: 0, x: toScreenX(f.fx), y: toScreenY(f.fy), z: width * FACE_DIST, ax: toScreenX(f.fx), aw: f.w };   // ax, aw: where and how big they arrived
      if (faces.length) newcomer = { p, until: now + 3000 };                                     // someone joined: all eyes turn to them
      else if (eyes.some((e) => e.sleep > 0.3)) wakeWave(toScreenX(f.fx), toScreenY(f.fy));   // woken up by someone arriving
      faces.push(p);
    }
    matched.push(p);
    p.fx.f(f.fx, t); p.fy.f(f.fy, t); p.w.f(f.w, t);
    p.lastSeen = p.tDet = now;
    p.close = sstep(0.15, 0.5, p.w.x());
    if (f.yaw !== undefined) p.yaw = lerp(p.yaw === undefined ? f.yaw : p.yaw, f.yaw, 0.5);
    if (!p.base && now - p.since > 1500) p.base = { y: p.fy.x(), w: p.w.x() };   // how they stood on arriving
    const i = faces.indexOf(p);
    if (f.shut > 0.5 && !p.wasShut) {      // you blinked: the eyes watching you blink back, a moment later (the beast: once it listens)
      p.wasShut = true; p.shutAt = now;
      if (!STORY || trust > 0.3) eyes.forEach((e) => { if (e.face === i && e.blinkStart < 0) e.blinkAt = t + random(0.05, 0.2); });
    } else if (f.shut >= 0 && f.shut < 0.35) {
      if (p.wasShut && STORY && i === 0) {   // eyes open again: a slow blink (a quarter second or more) says you mean no harm
        const d = now - p.shutAt;
        p.lastBlink = now;
        if (d >= 250 && d <= 2000) {
          addTrust(0.09, 'a slow blink');
          eyes.forEach((e) => { if (e.sleep < 0.7 && e.blinkStart < 0) { e.blinkAt = t + random(0.4, 1.1); e.blinkDur = random(0.8, 1.2); } });   // answered slowly
        } else addTrust(0.01, 'a blink');
      }
      p.wasShut = false;
    }
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
  if (grow > 0.05) lastAdapt = millis();   // grown round you costs more for a while: not a reason to lose eyes
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

// ---------- lost souls: the life cycle ----------
function lifeStep(dt) {
  if (!LIVES || LAYOUT === 'grid') return;
  eyes.forEach((e) => {
    if (e.ready === false) return;   // a newborn still getting its colours
    if (!e.dying && e.alpha < 1) { e.alpha = min(1, e.alpha + dt / BORN_S); e.ls = 0.3 + 0.7 * sstep(0, 1, e.alpha); }   // born: grows out of a point of light
    // held: close round you (the inner ring) or guarding you; those never die then. The rest of the ring ages
    // a little slower, so now and then a soul passes quietly at the edge of your circle
    const held = faces.length && (e.watch || faces.some((p) => sq(e.x - p.x) + sq(e.y - p.y) < sq(cell * 1.6 * (1 + GROW * grow * 0.6))));
    e.age += dt * (held ? 0.2 : e.gath > 0.2 ? 0.6 : 1);
    if (!e.dying && e.age > e.life && !held && shock < 0.1) { e.dying = 0.001; mourn(e); soulSound('die', e); }   // never in the middle of a moment with you
    if (!e.dying) return;
    e.dying += dt / DIE_S;
    // it closes for the last time, shrinks and rises slowly into the dark
    e.alpha = 1 - sstep(0.4, 1, e.dying); e.ls = 1 - 0.75 * sstep(0.25, 1, e.dying);
    e.hy -= cell * 0.25 * dt * sstep(0.2, 0.6, e.dying);
    if (e.dying >= 1) reborn(e);
  });
}
// a new soul in place of the old one: new colours, size and character, somewhere free in the dark, away from people
function reborn(e) {
  const count = (ty) => eyes.filter((o) => o.type === ty).length;
  const type = shuffle(Object.keys(TYPES)).sort((a, b) => count(a) - count(b))[0];
  const pal = naturalPalettes(1, eyes.filter((o) => o !== e).map((o) => o.pal))[0];
  const keep = { buf: e.buf, col: e.col }, ox = e.hx, oy = e.hy;
  if (e.veins) e.veins.remove();
  Object.assign(e, makeEye(pal, type), keep);
  let bd = -1;
  range(60).forEach(() => {
    const x = random(0.04, 0.96) * width, y = random(0.06, 0.94) * height;
    let d = 2 * min(x, width - x, y * 1.6, (height - y) * 1.6);
    eyes.forEach((o) => { if (o !== e) d = min(d, sqrt(sq(x - o.hx) + sq((y - o.hy) * 1.6))); });
    faces.forEach((p) => { d = min(d, sqrt(sq(x - p.x) + sq(y - p.y)) * 0.5); });
    d = min(d, sqrt(sq(x - ox) + sq(y - oy)) * 0.5);   // not where the old one just died
    if (d > bd) { bd = d; e.x = e.hx = x; e.y = e.hy = y; }
  });
  e.s = e.sc; e.life = random(LIFE[0], LIFE[1] || LIFE[0]); e.age = 0; e.alpha = 0; e.ls = 0.3; e.sxPrev = undefined;
  e.sleep = 1; e.wakeAt = 1e12; e.ready = false;
  drawOrder = eyes.slice().sort((a, b) => a.s - b.s);
  range(4).forEach((k) => jobs.push(() => colourise(e, k * R / 4, (k + 1) * R / 4)));   // a quarter of its colours a frame: no hitch
  jobs.push(() => { renderEye(e, millis() / 1000); e.ready = true; e.wakeAt = millis() + random(800, 2000); soulSound('born', e); });   // it opens slowly, after it appears
}

// ---------- the beast's trust ----------
// The story is told at the top of this file. Here: trust (0..1) toward its friend (always faces[0]), whether it
// is their companion yet, how long they have stood still, how grown it is round them, and what it remembers.
let trust = STORY ? Math.min(1, Math.max(0, opt('trust', 0))) : 1, trustNote = '', trustNoteAt = 0, frightAt = 0;
let companion = trust >= 1, stillFor = 0, grow = 0, friend = null, mem = null, strangerNow = null;
const braveLine = () => trust * 1.4 - 0.06;   // eyes braver than this come out: the bravest first, once you have been still a little
const brave = (e) => !STORY || e.brave < braveLine();
const sz = (e) => e.s * (1 + GROW * grow * e.gath) * e.ls;   // grown round you when you stop; ls: smaller while being born or dying
function addTrust(d, why) {
  trust = constrain(trust + d, 0, 1);
  if (why && (abs(d) > 0.005 || millis() - trustNoteAt > 4000)) { trustNote = (d > 0 ? '+ ' : '− ') + why; trustNoteAt = millis(); }
}
// pushed too hard: it loses trust, the eyes shut and flinch away, and it won't be scared again for a moment
function fright(d, why, sound) {
  const now = millis();
  if (now - frightAt < 2500) return;
  if (companion) {   // your companion trusts you, but a loud sound still startles it: a smaller fright, and it stays
    if (!sound) return;
    frightAt = now; jumpAt = now; say.lastFright = now; say.frightSound = 'startled';
    eyes.forEach((e) => {
      e.hide = now + random(500, 1400);                                       // every eye flinches shut
      if (random() < 0.35) e.goneUntil = now + random(700, 2000);             // a few slip into the dark for a moment
    });
    grow = max(0, grow - 0.5); rest = 0; restFor = 0;                         // it shrinks back, and wakes if it slept
    gasp(0.6, startle.x);
    return;
  }
  frightAt = now; say.lastFright = now; say.frightSound = !!sound; addTrust(-d, why);
  if (faces.length) mood = min(1, mood + 0.06);   // every fright someone gives it stays with it a while
  const p = faces[0];
  gasp(1, sound ? startle.x : p ? p.x : width / 2);
  if (!sound) { startle.at = now / 1000; startle.x = p ? p.x : width / 2; startle.y = p ? p.y : height / 2; }
  eyes.forEach((e) => {
    e.hide = now + random(1200, 3500);
    e.goneUntil = now + 1800 + 3500 * e.brave + random(0, 600);   // too loud or too fast: every eye vanishes; the bravest come back first
  });
}
function storyStep(dt) {
  if (!STORY) return;
  mood -= mood * dt / 1800;
  const now = millis();
  faces.forEach((q) => {   // how calm each person is: still time counts up, moving counts it down faster
    if (now - q.since < 1500 || now - (q.jumpAt || -1e9) < 1000) return;   // just arrived or found again: the filters are still settling
    const vx = q.fx.v(), vy = q.fy.v(), sp = sqrt(vx * vx + vy * vy);
    const hw = max(0.1, q.w.x()) / 0.1;   // measured in head widths, so someone close to the camera isn't 'moving' when they sway
    q.moving = lerp(q.moving || 0, constrain(((sp + abs(q.w.v()) * 2) / hw - 0.06) / 0.25, 0, 1), min(1, dt * 4));   // 0 = still, 1 = walking
    q.calm = max(0, (q.calm || 0) + (q.moving < 0.15 ? dt : -2 * dt));
  });
  if (friend && !faces.includes(friend)) {
    const gone = friend;
    friend = null; stillFor = 0;
    if (!faces.length) {   // its friend left an empty room: it watches them go, and keeps them in mind for a while
      startFarewell(gone);
      mem = { trust, companion, at: now, x: gone.x, w: gone.w.x() }; trust = 0;
    }
    else {   // others are still here: it turns to the calmest of them, trusting them as much as it saw them stay calm
      const q = faces.reduce((a, b) => ((b.calm || 0) > (a.calm || 0) ? b : a));
      friend = q; trust = min(0.8, (q.calm || 0) / CALM * 0.8); trustNote = 'its friend left: it turns to you'; trustNoteAt = now;
    }
    if (!friend || trust < 1) companion = false;
  }
  if (mem && now - mem.at > REMEMBER * 1000) mem = null;   // too long: forgotten
  // the first person into the empty room, within the time it remembers, is greeted as the friend coming back
  // (it can't tell faces apart: nothing about anyone is stored, it only remembers that someone was its friend)
  // (it can't tell faces apart: someone who comes in from the side its friend left by, about as near, counts as
  // them; anyone else means the friend is gone, and the story starts again with the newcomer)
  const back = mem && faces.find((q) => q.since > mem.at);
  if (back) {
    if (faces.length === 1 && looksLikeFriend(back)) {
      friend = back; trust = mem.trust; companion = mem.companion;
      if (now - mem.at > 2000) greet(back);
    }
    mem = null;
  }
  if (!friend && faces.length) friend = faces[0];
  // people who came with the friend, or who stayed calm for a while, are part of its pack: never strangers
  faces.forEach((q) => { if (q !== friend && !q.pack && (abs(q.since - friend.since) < 4000 || q.calm > ACCEPT)) q.pack = true; });
  if (friend && faces[0] !== friend) faces.splice(faces.indexOf(friend), 1), faces.unshift(friend);   // the friend comes first
  strangerNow = findStranger();
  const p = friend;
  if (!p) {   // gone: it waits and shrinks back
    stillFor = 0; restFor = 0; rest = max(0, rest - dt * 1.2); grow = max(0, grow - dt * 0.7);
    return;
  }
  if (now - p.since < 1500 || now - (p.jumpAt || -1e9) < 1000) return;   // just arrived or found again: the filters are still settling
  const vx = p.fx.v(), vy = p.fy.v(), sp = sqrt(vx * vx + vy * vy), dw = p.w.v();
  const still = p.moving < 0.15;
  stillFor = still ? stillFor + dt : 0;
  if (!companion) {
    // a fright needs a real rush (a moment of it, in head widths), not one jumpy look from the camera
    const hw = max(0.1, p.w.x()) / 0.1, rush = dw / hw > 0.15 ? 1 : sp / hw > 0.75 ? 2 : 0;
    p.rushFor = rush ? (p.rushFor || 0) + dt : 0;
    if (p.rushFor > 0.15) { fright(rush === 1 ? 0.2 : 0.12, rush === 1 ? 'you came at it too fast' : 'a sudden move'); p.rushFor = 0; }
    if (heard > 0.2) addTrust(-HUSH * sqrt(heard) * dt / CALM, 'a noise: it listens, wary');   // only quiet stillness earns trust; noise loses it, like moving
    else if (stillFor > 1) addTrust(dt / CALM * (1 - 0.4 * MOOD * mood), 'you stayed still');   // a pause while walking doesn't count; slower on a bad day
    else addTrust(-LOSE * sqrt(p.moving) * dt / CALM, 'you moved');   // until it trusts you fully, moving loses trust LOSE times as fast as stillness earns it (small moves count too)
    if (trust >= 1) { companion = true; trustNote = 'it trusts you: it will follow you'; trustNoteAt = now; startPact(p); }
  }
  restFor = companion && stillFor > 1 && !stranger() && REST > 0 ? restFor + dt : 0;
  rest = restFor > REST ? min(1, rest + dt / 8) : max(0, rest - dt * 1.2);   // falls asleep slowly, wakes quickly
  const want = companion ? constrain((stillFor - 1) / 5, 0, 1) * (1 - jumpy()) : 0;   // you stop: after a second it settles and grows over 5 s (not while still startled)
  grow = want > grow ? min(want, grow + dt * 0.25) : max(want, grow - dt * 0.8);   // and shrinks quickly to follow you again
}

// it knows you again: every eye opens at once, they hurry to you and blink hello, nearest first
function greet(p) {
  const now = millis(), t = now / 1000;
  trustNote = 'it remembers you'; trustNoteAt = now; say.greeted = true;
  eyes.forEach((e) => {
    const d = dist(e.x, e.y, p.x, p.y) / width;
    e.wakeAt = now; e.sleep = min(e.sleep, 0.3); e.hide = 0;
    e.rushUntil = t + 2.5; e.blinkAt = t + 0.3 + d * 0.8; e.blinkDur = random(0.5, 0.7);
  });
}
// the moment it trusts you (about 5 s): every eye closes and stays where it is, the breath stops; then they open,
// nearest first, wider than ever, pupils large, with one deep breath; only then do they come to you
const PACT = opt('pact', 1) > 0;
let pactAt = -1e9, pactDone = -1e9, pactWide = 0;
// the day's mood (-0.5 bold .. 1 wary): what happened with the last visitors stays with it for a while, fading
// over about half an hour; the nightly fresh start begins a new day
let mood = 0;
// asleep beside you (0..1): the deepest trust. After REST seconds of stillness as your companion the eyes close one
// by one, the breath slows, now and then one opens to check you are still there; a gentle move wakes it
let rest = 0, restFor = 0;
// startled as your companion: for a few seconds it keeps a little further from you, then comes back
let jumpAt = -1e9;
const jumpy = () => 1 - sstep(0, 3.5, (millis() - jumpAt) / 1000);
const pactT = () => (millis() - pactAt) / 1000;
function startPact(p) {
  if (!PACT) return;
  const now = millis();
  pactAt = now;
  mood = max(-0.5, mood - 0.2);   // and every friend makes it a little bolder
  eyes.forEach((e) => {
    const d = dist(e.x, e.y, p.x, p.y) / width;
    e.hide = now + 1300 + d * 1500 + random(0, 200);   // shut together, open again one after another from you outward
    e.blinkAt = 1e9;
  });
}
function pactStep(dt) {
  const t = pactT();
  // wide eyes and large pupils: rise as they open, held a moment, then ease back over a few seconds
  const want = t < 1.2 ? 0 : t < 6 ? sstep(1.2, 3.2, t) : 1 - sstep(6, 9, t);
  pactWide = t > 9 || t < 0 ? 0 : want;
  if (t > 4.5 && pactAt > pactDone) { pactDone = pactAt; eyes.forEach((e) => { e.blinkAt = millis() / 1000 + random(2, 6); e.rushUntil = millis() / 1000 + 2; }); }   // now they come
}
// the same side it left by (or the same spot, if it left from the middle), and a face of about the same size
function looksLikeFriend(q) {
  const side = (x) => (x < width / 3 ? -1 : x > width * 2 / 3 ? 1 : 0), s = side(mem.x);
  const near = s === 0 ? abs(q.ax - mem.x) < width * 0.35 : side(q.ax) === s || abs(q.ax - mem.x) < width * 0.25;
  return near && abs(q.aw - mem.w) < mem.w * 0.4;
}

// its friend has gone: every eye watches the place they left by, the closest companions drift a little after
// them, then it lets out one long breath and they all blink slowly, and the room is quiet again
let farewell = null;
const farewellT = () => (farewell ? (millis() - farewell.at) / 1000 : 1e9);
function startFarewell(p) {
  const edge = p.x < width * 0.35 ? cell * 0.4 : p.x > width * 0.65 ? width - cell * 0.4 : p.x;   // out by the side, or straight back
  farewell = { at: millis(), x: edge, y: constrain(p.y, height * 0.2, height * 0.8), close: companion || trust > 0.5, blinked: false };
}
function farewellStep() {
  const t = farewellT();
  if (!farewell || faces.length || t > 8) { farewell = faces.length ? null : farewell; return; }
  if (t > 5.5 && !farewell.blinked) {
    farewell.blinked = true;
    const now = millis() / 1000;
    eyes.forEach((e) => { if (e.sleep < 0.7) { e.blinkAt = now + random(0, 0.6); e.blinkDur = random(0.9, 1.3); } });
  }
}

// the stranger: someone else who came later and hasn't settled yet, the one nearest to the friend
function stranger() { return strangerNow; }
function findStranger() {
  const others = faces.slice(1).filter((q) => !q.pack);
  if (!others.length) return null;
  return others.reduce((a, q) => (abs(q.x - faces[0].x) < abs(a.x - faces[0].x) ? q : a));
}
// your companion guards you: about half its eyes keep watching the stranger; if the stranger comes close to you,
// all of them do. Before that (no companion yet) a stranger only gets a look as they arrive
function guardOf(e) {
  const s = companion && faces.length > 1 && stranger();
  if (!s) return null;
  const close = abs(s.x - faces[0].x) < cell * 2.5;
  return close || e.ear < 0.5 ? s : null;
}

// ---------- left alone for days (an installation) ----------
// The mouse pointer hides when it stops moving; the screen is asked not to sleep; a camera that stops
// (unplugged, frozen, taken by another app) is reopened; and once a night, with nobody there, the page
// reloads itself so it runs for days without anyone touching it.
const RELOAD_AT = opt('reload', 4);   // hour of the night to start afresh (24-hour clock; -1 = never)
let pointerAt = 0, reloadTry = -1e9, wakeLock = null, camT = -1, camStuckSince = 0, camReopenAt = -1e9, camWorked = false;
function keepAwake() {
  if (!navigator.wakeLock || document.visibilityState !== 'visible' || wakeLock) return;
  navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
}
function watchdog() {
  const now = millis();
  keepAwake();
  if (now - pointerAt > 3000) noCursor();
  // the camera: once it has worked, frames must keep coming; if not for 8 s, reopen it (not more than every
  // 30 s). Never before it first works, so a visitor isn't asked for the camera again and again
  const v = cam && cam.elt, track = v && v.srcObject && v.srcObject.getVideoTracks()[0];
  if (v) {
    const ended = !track || track.readyState === 'ended';
    if (v.readyState >= 2 && v.currentTime !== camT && !ended) { camT = v.currentTime; camStuckSince = now; camWorked = true; }
    else if (camWorked && now - camStuckSince > 8000 && now - camReopenAt > 30000) {
      camReopenAt = now; camStuckSince = now;
      console.warn('camera stopped: reopening it');
      try { v.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) { /* already gone */ }
      camT = -1;
      cam.remove(); rvfc = false; openCamera();   // frames are then looked at from draw()
    }
  }
  // the nightly fresh start: past the hour, running at least 12 h, and nobody there for a minute; only if it can
  // start again: everything is kept in the browser (sw.js), or else the internet answers. If not, it keeps running
  // and tries again in a minute
  const d = new Date();
  if (RELOAD_AT >= 0 && d.getHours() === RELOAD_AT && now > 12 * 3600 * 1000 && !faces.length && now - seenAt > 60000 && !recorder && now - reloadTry > 60000) {
    reloadTry = now;
    const online = () => fetch(MP + '/package.json', { cache: 'no-store' }).then((res) => { if (res.ok) location.reload(); }).catch(() => {});
    if (window.caches) caches.match(MODEL).then((kept) => (kept ? location.reload() : online())).catch(online); else online();
  }
}
function mouseMoved() { pointerAt = millis(); cursor(); }
document.addEventListener('visibilitychange', keepAwake);

// ---------- the narrator (words=1) ----------
// Short lines at the bottom of the screen that tell the story and, at the same time, what to do next: each one
// once per visitor, at the moment it matters, faded in and out, one at a time. In Greek, English, Hungarian and
// Spanish: lang=el|en|hu|es chooses the first one, and visitors can change it with the faint ΕΛ EN HU ES in the top-right corner
// (or the L key). words=0: none.
// If someone is stuck (moving or talking for a while and trust isn't growing), the advice comes back.
const WORDS = opt('words', 1) > 0;
const LANGS = ['en', 'el', 'hu', 'es'], LANG_NAMES = ['EN', 'ΕΛ', 'HU', 'ES'], LANG_ORDER = [1, 0, 2, 3];   // the order of the words in each line; the switch shows ΕΛ EN HU ES
const LANG0 = LANGS.includes(Q.get('lang')) ? LANGS.indexOf(Q.get('lang')) : 1;   // Greek unless lang= says otherwise
let lang = LANG0, langBox = [], langSeen = 0;
const SAYINGS = {   // [English, Greek, Hungarian, Spanish]
  arrive: ['Something in the dark is watching you.', 'Κάτι στο σκοτάδι σε κοιτάζει.', 'Valami a sötétben figyel téged.', 'Algo en la oscuridad te está mirando.'],
  afraid: ['It is afraid. Stand still.', 'Φοβάται. Μην κουνιέσαι.', 'Fél. Ne mozdulj.', 'Tiene miedo. No te muevas.'],
  noise: ['Shh. It is listening.', 'Σσσ. Ακούει.', 'Pszt. Fülel.', 'Shh. Está escuchando.'],
  fright: ['Too fast. It hides.', 'Πολύ απότομα. Κρύβεται.', 'Túl gyors. Elbújik.', 'Demasiado rápido. Se esconde.'],
  loud: ['Too loud. It hides.', 'Πολύ δυνατά. Κρύβεται.', 'Túl hangos. Elbújik.', 'Demasiado fuerte. Se esconde.'],
  startled: ['It startles, but stays with you.', 'Τρομάζει, αλλά μένει μαζί σου.', 'Megriad, de veled marad.', 'Se asusta, pero se queda contigo.'],
  used: ['It is getting used to you.', 'Αρχίζει να σε συνηθίζει.', 'Kezd megszokni téged.', 'Se está acostumbrando a ti.'],
  closer: ['Closer now. Don\'t move.', 'Πιο κοντά τώρα. Μην κουνιέσαι.', 'Közelebb jön. Ne mozdulj.', 'Más cerca ahora. No te muevas.'],
  trusts: ['It trusts you. Walk, and it follows.', 'Σε εμπιστεύεται. Περπάτα, και θα σε ακολουθήσει.', 'Megbízik benned. Indulj el, és követni fog.', 'Confía en ti. Camina y te seguirá.'],
  grown: ['Stay, and it gathers its strength around you.', 'Μείνε, και μαζεύει τη δύναμή του γύρω σου.', 'Maradj, és köréd gyűjti az erejét.', 'Quédate y reunirá su fuerza a tu alrededor.'],
  guard: ['Someone else is here. It guards you.', 'Κάποιος άλλος είναι εδώ. Σε προστατεύει.', 'Valaki más is itt van. Vigyáz rád.', 'Hay alguien más aquí. Te protege.'],
  back: ['It remembers you.', 'Σε θυμάται.', 'Emlékszik rád.', 'Te recuerda.'],
  sleeps: ['It sleeps beside you. Move gently.', 'Κοιμάται δίπλα σου. Κινήσου απαλά.', 'Melletted alszik. Mozdulj óvatosan.', 'Duerme a tu lado. Muévete con cuidado.'],
};
const say = { said: new Set(), queue: [], now: null, at: 0, who: null, stuckSince: 0, trustAgo: 0, trustAt: 0, lastFright: 0, greeted: false };
function tell(what, again) {
  if ((!again && say.said.has(what)) || say.queue.includes(what) || (say.now === what)) return;
  say.said.add(what); say.queue.push(what);
}
function narrate(dt) {
  if (!WORDS || !STORY) return;
  if (mic && mic.ac.state !== 'running') {   // the browser keeps the microphone off until a click: say so, faintly (a kiosk started with start_iris.bat never needs it)
    const c = drawingContext; c.save(); c.font = '14px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(222,214,204,0.35)';
    c.fillText(['Click once, so it can hear you', 'Ένα κλικ, για να σε ακούει', 'Kattints egyszer, hogy hallhasson.', 'Haz clic una vez para que pueda oírte.'][lang], width / 2, 24); c.restore();
  }
  const now = millis(), p = friend && faces.includes(friend) ? friend : null;
  if (p !== say.who && p) { say.said = new Set(); say.queue = []; say.who = p; say.stuckSince = now; }   // a new visitor: the story from the start
  if (p) {
    const here = now - p.since;
    if (say.greeted) { say.greeted = false; say.said = new Set(['arrive', 'afraid', 'used', 'closer']); tell('back'); }
    if (here > 1000) tell('arrive');
    if (!companion && here > 3500 && trust < 0.4) tell('afraid');   // what to do, as early as it can be read
    if (!companion && p.moving > 0.5 && trust > 0.1 && now - (say.movedAt || 0) > 10000 && say.said.has('afraid')) { say.movedAt = now; tell('afraid', true); }   // losing trust by moving: say again what it needs
    if (now - say.lastFright < 300) { say.lastFright = 0; say.now = say.frightSound === 'startled' ? 'startled' : say.frightSound ? 'loud' : 'fright'; say.at = now; }   // at once, over whatever was said
    if (!companion && heard > 0.25 && here > 4000 && trust < 0.5) tell('noise');
    if (!companion && heard > 0.4 && trust > 0.1 && now - (say.noiseAt || 0) > 10000 && say.said.has('noise')) { say.noiseAt = now; tell('noise', true); }   // losing trust to noise: say again
    if (trust > 0.35 && !companion) tell('used');
    if (trust > 0.7 && !companion) tell('closer');
    if (companion) tell('trusts');
    if (companion && grow > 0.8) tell('grown');
    if (companion && stranger()) tell('guard');
    if (rest > 0.6) tell('sleeps');
    // stuck: 20 s without trust growing while it is still afraid: say again what it needs
    if (now - say.trustAt > 2500) { if (trust - say.trustAgo > 0.04 || companion) say.stuckSince = now; say.trustAgo = trust; say.trustAt = now; }
    if (now - say.stuckSince > 20000) { say.stuckSince = now; tell(/noise/.test(trustNote) ? 'noise' : 'afraid', true); }
  } else say.queue = [];
  // one line at a time: faded in, held long enough to read, faded out; the next waits its turn, and a line the
  // story has already moved past is dropped instead of said late
  const stale = { sleeps: rest < 0.3, afraid: companion || (trust > 0.45 && !(friend && friend.moving > 0.3)), noise: companion || (trust > 0.6 && heard < 0.3), used: trust > 0.75 || companion, closer: companion };
  while (!say.now && say.queue.length) { const k = say.queue.shift(); if (!stale[k]) { say.now = k; say.at = now; } }
  if (!say.now) return;
  const t = (now - say.at) / 1000, words = SAYINGS[say.now][lang], hold = 1.8 + words.length * 0.04;
  if (t > hold + 1.6) { say.now = null; return; }
  const a = 0.62 * min(sstep(0, 0.8, t), 1 - sstep(hold + 0.8, hold + 1.6, t));
  const ctx = drawingContext, size = round(constrain(min(width, height) * 0.032, 15, 40));
  ctx.save();
  ctx.font = size + 'px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = size * 0.8;   // readable over an eye
  ctx.fillStyle = 'rgba(222,214,204,' + a.toFixed(3) + ')';
  ctx.fillText(words, width / 2, height - max(size * 1.6, height * 0.06));
  ctx.restore();
}

// the language switch: faint letters in the top-right corner, the one in use brighter. A click or tap on one
// changes the narrator's language (the L key steps through them). In an installation (kiosk=1) it goes back to
// the first language after a minute with nobody there, ready for the next visitor. Not drawn in videos.
function langSwitch() {
  langBox = [];
  if (!WORDS || !STORY) return;
  if (faces.length) langSeen = millis();
  else if (KIOSK && lang !== LANG0 && millis() - langSeen > 60000) lang = LANG0;
  if (recorder) return;
  const ctx = drawingContext, size = round(constrain(min(width, height) * 0.022, 13, 24)), gap = size * 1.1, y = size * 1.5;
  ctx.save(); ctx.font = size + 'px Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let x = width - size;
  LANG_ORDER.slice().reverse().forEach((i) => {
    const w = ctx.measureText(LANG_NAMES[i]).width;
    x -= w;
    ctx.fillStyle = 'rgba(222,214,204,' + (i === lang ? 0.55 : 0.2) + ')';
    ctx.fillText(LANG_NAMES[i], x, y);
    langBox.push({ i, x0: x - gap / 2, x1: x + w + gap / 2, y0: 0, y1: y + size });   // easy to hit with a finger
    x -= gap;
  });
  ctx.restore();
}
function setLang(i) {
  lang = i; langSeen = millis();
  if (say.now) say.at = millis() - 800;   // the line being said shows again at once, in the new language
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
  if (k === 's') saveCanvas('iris-' + seed + '-' + frameCount, 'png');
  if (k === 'r') recolour();
  if (k === 'v') toggleRecording();
  if (k === 'd') showCam = !showCam;
  if (k === 'c') startCalib();
  if (k === 'l') setLang(LANG_ORDER[(LANG_ORDER.indexOf(lang) + 1) % LANG_ORDER.length]);   // the next language
}
// double-tap (phone) or double-click: show or hide the camera view, like the D key
let lastTap = -1e9;
function mousePressed() {
  armSound();
  const hit = langBox.find((b) => mouseX >= b.x0 && mouseX <= b.x1 && mouseY >= b.y0 && mouseY <= b.y1);
  if (hit) { setLang(hit.i); lastTap = -1e9; return; }   // a language, not half of a double-tap
  if (KIOSK) return;   // visitors can't open it by accident
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
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) { console.warn('video recording is not supported in this browser'); return; }
  const chunks = [], stream = drawingContext.canvas.captureStream(30);
  if (voice && voice.master && voice.ac.createMediaStreamDestination) {   // with its sound (what it plays, not the microphone)
    if (!voice.rec) { voice.rec = voice.ac.createMediaStreamDestination(); voice.master.connect(voice.rec); }
    voice.rec.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
  recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type }));
    a.download = 'iris-' + seed + '-' + Date.now() + (type.includes('mp4') ? '.mp4' : '.webm');
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
