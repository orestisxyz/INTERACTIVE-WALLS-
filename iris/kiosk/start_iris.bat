@echo off
rem Iris: start the installation full screen, with sound and camera, in its own browser profile.
rem Double-click to start. If the browser closes or crashes, it opens again after 5 seconds.
rem To stop it: Alt+F4, then close this black window within 5 seconds.
rem To start it when Windows starts, put a shortcut to this file in the Startup folder
rem (press Win+R, type shell:startup, press Enter).
rem Settings go in the address below: lang=en English words first (el Greek, hu Hungarian, es Spanish; visitors
rem can switch in the top-right corner), kiosk=1 visitors can't open the camera view. For a busy, talking opening night add &hush=1 (or &sound=0 in a very loud room).

set "URL=https://orestisxyz.github.io/INTERACTIVE-WALLS-/iris/?lang=en&kiosk=1"
set "PROFILE=%LOCALAPPDATA%\IrisKiosk"

set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" (
  echo Chrome or Edge not found. Install one of them, or edit this file.
  pause
  exit /b
)

rem --kiosk: full screen, no bars.  --autoplay-policy: sound without a click (also after the nightly reload).
rem --user-data-dir: its own profile, so these settings never touch your normal browsing.
:again
echo Iris is running. Close this window to stop it coming back.
start "" /wait "%BROWSER%" --user-data-dir="%PROFILE%" --kiosk --autoplay-policy=no-user-gesture-required --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-features=Translate --overscroll-history-navigation=0 "%URL%"
timeout /t 5
goto again
