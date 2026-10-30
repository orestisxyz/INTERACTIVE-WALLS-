# Interactive Walls

A family of works by ORE.XYZ (Orestis Dimopoulos) for a wall, a screen or a projection that notice the people in front of them. Each work lives in its own folder and runs in the browser with p5.js.

Live: https://orestisxyz.github.io/INTERACTIVE-WALLS-/

| # | Work | What it does |
|---|------|--------------|
| 01 | [Iris](iris/) | A shy creature of eyes in the dark. It runs from you at first; stay still and it learns to trust you, then follows you and grows round you whenever you stop. |

## Iris

**How it behaves.** Scared at first, the eyes hide at the edges and keep away, further the more you move, so chasing them drives them off. Only standing still earns their trust (rushing at them or a loud sound frightens them). As trust grows the bravest eyes come first, then the rest, circling closer. Once it trusts you it follows you, and every time you stop it settles round you and grows. Leave for a while and it slowly forgets you. `calm` sets the seconds of stillness it needs (default 12), `grow` how big it gets (default 0.8 = up to 1.8x), `trust=1` starts it tame, `story=0` turns the story off (it simply follows).

- **Camera:** finds faces with MediaPipe (BlazeFace), on your device. No image leaves the browser; nothing is recorded or sent.
- **Microphone:** only listens for loud sounds, which startle the eyes.
- **Sound:** a breathing sound, which starts after the first click, tap or key.
- **Keys:** F fullscreen, S save a still, R new colours, V record a video, D show what the camera sees and how much it trusts you, C calibrate.
- **Calibrate for a wall:** if the camera is off to one side or far from the screen, press C and follow the words: stand in the middle, then at one side, then the other (a few seconds each). It is saved in that browser. Add `?calib=0` to the address to forget it.
- **As many eyes as the device can hold:** it starts with the number that suits the screen, then adds eyes while the animation stays smooth and removes some if it starts to stutter. Each device remembers its number for next time. `eyes=20` fixes the count; `most` (default 120) and `minsize` (smallest room per eye in px, default 100) set the limits.
- **Settings in the address**, for example `iris/?space=1.7&turn=45&tilt=25&sleep=20`: `space` (fewer eyes when higher), `around` (0 = they stay scattered), `turn` and `tilt` (degrees), `follow` (how much the whole eye turns with its gaze, 0 to 1), `sleep` (seconds before they fall asleep), `sound` (0 = no microphone), `seed` (same layout and colours every time). The top of `iris/sketch.js` lists the rest.
- **Needs:** https or localhost for the camera; an internet connection on first load (p5.js and the face model come from CDNs).

## Run it locally

```
cd INTERACTIVE-WALLS-
python -m http.server 8000
```

Then open http://localhost:8000/iris/ and allow the camera.

## Adding a work

Make a folder (`02-name/`) with its own `index.html`, then add a line to the list in `index.html` and to the table above.
