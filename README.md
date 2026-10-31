# Interactive Walls

A family of works by ORE.XYZ (Orestis Dimopoulos) for a wall, a screen or a projection that notice the people in front of them. Each work lives in its own folder and runs in the browser with p5.js.

Live: https://orestisxyz.github.io/INTERACTIVE-WALLS-/

| # | Work | What it does |
|---|------|--------------|
| 01 | [Iris](iris/) | A shy beast made of eyes in the dark. It runs from you at first; stand still and quiet and it learns to trust you, then follows you, guards you from strangers, and watches you go. |

## Iris

**The story.** A narrator line at the bottom says what is happening and what to do (`lang=el` for Greek).

1. **Afraid.** When you arrive the eyes run to the edges, look away and steal glances. Moving or talking makes it worse: until it trusts you, moving and noise take trust away three times faster than stillness builds it. A rush or a clap frightens it (a gasp, the eyes shut); a loud bang makes every eye vanish into the dark, and they come back slowly, the bravest first.
2. **Trust.** Stand still and quiet. The bravest eyes come closer first. Full trust takes about 16 s of calm.
3. **The pact.** At full trust every eye shuts, then they open wide, nearest first, with one deep breath.
4. **Companion.** It follows you. Stop, and it gathers round you and grows, humming softly. If it hears something, it keeps watch for you; a loud bang still startles it a little, but it stays. Stay still for a minute and it falls asleep beside you, one eye now and then checking you are still there.
5. **A stranger.** Someone else arrives, and it guards you until they have stayed calm for a while. People who come with you are part of the pack.
6. **Leaving.** Out of view for 6 s, you are gone: it watches the side you left by and lets out a long breath. Come back the same way within 30 s and it greets you. Anyone else starts the story afresh. It can't recognise faces: it only guesses from where you come in and how near you are.

**Around the story.** Each eye is a lost soul that lives a few minutes, fades, and is born again somewhere else; the eyes near it turn to watch it go. Each soul has a voice of its own: a soft bing in its own note when it blinks, that note when it is born, and a whisper when it dies. The beast also has a mood for the day: frights make it shyer for the next visitors, friends make it bolder, and it settles over about half an hour.

- **Camera:** finds faces with MediaPipe on this device. No image leaves the browser, nothing is recorded or sent, and no face is recognised.
- **Microphone:** listens to the room's loudness only (noise, claps, bangs).
- **Sound:** a breathing voice, the souls' small voices, all ringing in a large dark room (an echo made in code) and coming from where they happen on the screen (left or right speaker). Best on speakers or headphones: laptop speakers lose the low tones. In a normal browser it starts after the first click, tap or key; the kiosk start file needs no click.
- **Keys:** F fullscreen, S save a still, R new colours, V record a video, D what the camera sees (faces, trust, fps, eye count, mood), C calibrate for a wall.
- **Calibrate for a wall:** if the camera is off to one side or far from the screen, press C and follow the words (middle, one side, the other). It is saved in that browser. `?calib=0` forgets it.
- **As many eyes as the device can hold**, up to 24 by default: it adds eyes while the animation stays smooth and removes some if it stutters, and remembers the number per screen.
- **Works offline after the first start:** `sw.js` keeps a copy of p5, the face model and the sketch in the browser.
- **Settings in the address**, for example `iris/?lang=el&calm=20`:

| Setting | Default | What it does |
|---|---|---|
| `calm` | 16 | seconds of stillness for full trust |
| `lose` / `hush` | 3 / 3 | how much faster moving / noise take trust away than stillness builds it |
| `shy`, `snap`, `tempo` | 1, 1.4, 0.6 | how far it runs, how fast it comes and goes, how fast its small glances are |
| `grow` | 0.8 | how much it grows round you (0.8 = up to 1.8x) |
| `accept`, `hold`, `remember` | 8, 6, 30 | seconds before a stranger is accepted; seconds out of view before you count as gone; seconds it remembers you |
| `rest` | 60 | seconds of stillness as companion before it sleeps beside you (0 = never) |
| `gasp`, `hum`, `mourn` | 1, 1, 1 | the gasp on a fright; the hum round you; eyes watching a soul go (0 turns each off) |
| `pact`, `mood`, `story` | 1, 1, 1 | the trust moment; the day's mood; 0 turns each off (`story=0`: it simply follows) |
| `trust` | 0 | `trust=1` starts it tame |
| `words`, `lang` | 1, en | narrator lines; `lang=el` for Greek |
| `most`, `eyes`, `life` | 24, adaptive, 60-360 | most eyes; a fixed count; seconds each soul lives (`life=0` for ever) |
| `sound`, `rhythm`, `breath` | 1, 1, 1 | microphone; claps and beats; the breathing voice |
| `reverb`, `stereo`, `voices` | 1, 1, 1 | the room's echo (2 = twice as much); sounds from their side; the souls' voices (0.5 = half as loud). 0 turns each off |
| `kiosk`, `reload`, `dpr`, `offline` | 0, 4, 2, 1 | installation: no double-click camera view; nightly fresh start hour (-1 = never); screen sharpness; offline copy |

The top of `iris/sketch.js` lists the rest. **Installing it for days:** see [iris/kiosk/SETUP_WINDOWS.md](iris/kiosk/SETUP_WINDOWS.md), the start file `iris/kiosk/start_iris.bat`, and a wall label draft in `iris/kiosk/WALL_LABEL.md`.

**Needs:** https or localhost for the camera, and internet the first time it starts.

## Run it locally

```
cd INTERACTIVE-WALLS-
python -m http.server 8000
```

Then open http://localhost:8000/iris/ and allow the camera.

## Adding a work

Make a folder (`02-name/`) with its own `index.html`, then add a line to the list in `index.html` and to the table above.

## Licence

The code is open: MIT licence (see [LICENSE](LICENSE)). Learn from it, take techniques, build your own things with it.

The artworks are not: the works themselves (Iris as an artwork, its name, story, narrator texts, look and sound, and any exhibition of it) are © 2026 Orestis Dimopoulos (ORE.XYZ), all rights reserved. To show a work, get in touch through [orexyz.com](https://orexyz.com).
