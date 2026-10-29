# Interactive Walls

A family of works by ORE.XYZ (Orestis Dimopoulos) for a wall, a screen or a projection that notice the people in front of them. Each work lives in its own folder and runs in the browser with p5.js.

Live: https://orestisxyz.github.io/INTERACTIVE-WALLS-/

| # | Work | What it does |
|---|------|--------------|
| 01 | [Iris](iris/) | Eyes in the dark that gather round you, turn and stare; they sleep when you leave and wake when you return. |

## Iris

- **Camera:** finds faces with MediaPipe (BlazeFace), on your device. No image leaves the browser; nothing is recorded or sent.
- **Microphone:** only listens for loud sounds, which startle the eyes.
- **Sound:** a breathing sound, which starts after the first click, tap or key.
- **Keys:** F fullscreen, S save a still, R new colours, V record a video, D show what the camera sees.
- **Settings in the address**, for example `iris/?space=1.7&turn=30&tilt=15&sleep=20`: `space` (fewer eyes when higher), `around` (0 = they stay scattered), `turn` and `tilt` (degrees), `sleep` (seconds before they fall asleep), `sound` (0 = no microphone), `seed` (same layout and colours every time). The top of `iris/sketch.js` lists the rest.
- **Needs:** https or localhost for the camera; an internet connection on first load (p5.js and the face model come from CDNs).

## Run it locally

```
cd INTERACTIVE-WALLS-
python -m http.server 8000
```

Then open http://localhost:8000/iris/ and allow the camera.

## Adding a work

Make a folder (`02-name/`) with its own `index.html`, then add a line to the list in `index.html` and to the table above.
