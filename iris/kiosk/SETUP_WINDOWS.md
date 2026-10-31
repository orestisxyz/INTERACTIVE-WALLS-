# Iris on a Windows laptop: running for days

## Once, before the show

1. **Start file.** Double-click `start_iris.bat`. The first time, the browser asks for the camera and the microphone: click Allow. Its own profile remembers this, so it never asks again. Let it run once with internet: after that it keeps a copy of everything and also starts without internet.
2. **Start with Windows.** Press Win+R, type `shell:startup`, press Enter, and put a shortcut to `start_iris.bat` in that folder.
3. **No sleep.** Settings > System > Power & sleep: Screen and Sleep both "Never" (plugged in). Also turn off the screen saver (Settings > Personalisation > Lock screen > Screen saver settings > None).
4. **No update restarts during the show.** Settings > Update & Security > Windows Update > Pause updates (up to 35 days). Set Active hours to cover the opening hours.
5. **No pop-ups.** Settings > System > Focus assist: Alarms only. Close or uninstall apps that show notifications.
6. **Camera access.** Settings > Privacy > Camera: allow apps and desktop apps. Same for Microphone. Don't open other apps that use the camera (Teams, Zoom, Camera app) while it runs.
7. **Optional, to restart by itself after a power cut:** in the BIOS, set "AC power recovery" to On, and let Windows sign in without a password (Win+R, `netplwiz`).
8. **Language.** The words start in Greek (`lang=el`); for another first language change it to `lang=en`, `lang=hu` or `lang=es` in the address inside the file. Visitors can switch with the faint ΕΛ EN HU ES in the top-right corner (with a mouse or a touch screen); a minute after the last visitor leaves, it goes back to the first language.

## The room

- **Light on faces.** The eyes need to see a face. Keep the room dark around the screen, but put a dim, warm lamp above or behind the screen, aimed at where people stand. Without it the work can't find anyone and looks broken.
- **Where to stand.** It sees faces best from about 0.5 to 2 m. Put a small mark on the floor about 1.2 to 1.5 m from the camera (tape, a circle, a word). It also quietly says "stay here", which is what the work asks.
- **Camera.** At face height, centred above or below the screen. Then press **C** and follow the words to calibrate. For the middle step, stand at about the height of an adult's chest, so children and wheelchair users also fall inside.
- **Sound.** Keep the speakers a little away from the laptop's microphone.
- **Check it.** Press **D**: the camera image with a green box on each face, the trust bar, and a line with fps, eye count and face-search time. Walk through the whole standing area and check the green box stays. If fps stays under 45, add `&most=16` to the address. Press D again to hide it.

## Busy days

Talking costs trust, as moving does. On a quiet day that is the point; on an opening night full of talk nobody gets far. Ready-made addresses (add to the end of the address in the start file):

- `&hush=1`: noise costs a third as much.
- `&sound=0`: it doesn't listen at all (a very loud room).
- `&lose=1.5&calm=12`: gentler for children and people who can't stand still.

## What it does by itself

- Hides the mouse pointer, keeps the screen awake.
- Reopens the camera if it stops sending pictures for 8 s.
- If the browser closes or crashes, the start file opens it again after 5 s.
- At 4 am, with nobody there for a minute, it reloads for a fresh start (a new day: its mood starts calm again). It does this only if it can start again: from its kept copy, or from the internet. Add `reload=-1` to the address to turn this off.
- Calibration and the eye count are kept in the browser profile, so a reload keeps them.
- If something is wrong, faint words show in the bottom-left corner: "no camera", or "face search not loaded" (it has never started with internet).

## Limits

- The very first start needs internet. After that it starts without.
- To stop it: Alt+F4, then close the black window within 5 seconds.
