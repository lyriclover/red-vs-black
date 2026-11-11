==========================================================================
  RED vs BLACK  ·  CARD CHALLENGE
  Premium automatic card game for live streams (YouTube Live / OBS)
  Virtual entertainment only - points & statistics, no real money.
==========================================================================

QUICK START
-----------
1. Unzip the archive anywhere (Desktop, Documents, ...).
2. Double-click  index.html
   -> it opens in your browser (Google Chrome recommended) and the game
      starts automatically. Nothing else is needed:
      no installation, no Node.js, no npm, no server, no build step,
      no internet connection.
3. Click once anywhere on the page to enable sound (browser rule, see SOUND).

   Tip: if a different browser opens, right-click index.html ->
   "Open with" -> Google Chrome (or set Chrome as your default browser).
   Works in Chrome, Edge, Firefox and Opera (latest versions).


HOW THE GAME WORKS
------------------
- Standard 52-card deck. Hearts & Diamonds = RED, Spades & Clubs = BLACK.
- The deck is shuffled with a cryptographically secure random generator
  (Fisher-Yates shuffle, crypto.getRandomValues).
- One card is dealt per round. A card never repeats until all 52 cards have
  been used; then a fresh deck is shuffled automatically ("NEW DECK").
- Every round runs by itself:
    countdown -> shuffle animation -> card dealt onto the podium ->
    countdown reaches 00:00 -> 3D card flip -> RED or BLACK result ->
    winner animation -> statistics & recent results update -> next round.
- The game runs forever until you pause it or close the browser.
- Progress (round number, deck, statistics, history, settings) is saved in
  the browser. Reopening index.html continues where it left off - rounds are
  never duplicated, replayed or skipped.
- If the game is opened in two tabs at once, only one tab deals the cards;
  the other one mirrors it (prevents duplicated rounds).


HIDDEN CONTROL PANEL
--------------------
Move the mouse: a small gold gear appears in the bottom-right corner
(or press S). It hides again automatically after a few seconds, so the
main screen stays clean.

  Start / Pause ........ pause or start the game (Space)
  Resume ............... continue a paused game
  Restart Game ......... new game, new shuffled deck, round 1 (click twice)
  Fullscreen ........... enter / exit fullscreen (F or double-click)
  Sound effects ........ ON/OFF + volume (N)
  Background music ..... ON/OFF + volume (M)
  Round interval ....... 10 s / 15 s / 20 s / 30 s   (default 15 s)
  Animation quality .... Low / Medium / High (use Low on older PCs)
  Reset Statistics ..... clears RED/BLACK wins and history (click twice)


KEYBOARD SHORTCUTS
------------------
  Space  pause / resume        F  fullscreen      S  control panel
  N      sound effects on/off  M  music on/off    Esc  close panel


SOUND
-----
Browsers block audio until the page has been clicked once. After opening
index.html, click anywhere (or press any key) and the music and effects
start. In an OBS Browser Source, audio plays automatically.
All sounds and the lounge music loop are original, generated for this
project and royalty-free (safe for YouTube streams).


OBS / YOUTUBE LIVE SETUP
------------------------
The design is exactly 1920 x 1080 (16:9). It scales to any window size and
never needs scrolling.

A) Browser Source (recommended)
   Sources -> + -> Browser -> tick "Local file" -> choose index.html
   Width 1920, Height 1080, tick "Control audio via OBS".
   For a completely clean capture (no gear, no notices), untick "Local file"
   and enter the URL instead, e.g.
     file:///C:/Games/red-vs-black/index.html?obs=1

B) Window Capture
   Open index.html in Chrome, press F (fullscreen) or F11, add a
   "Window Capture" source and select the Chrome window. Click once inside
   the game to enable sound. Keep the window open (not minimized).

C) Display Capture
   Run the game fullscreen on the monitor you capture.

Tip for 24/7 streaming with Window/Display Capture - start Chrome with:
  chrome.exe --autoplay-policy=no-user-gesture-required
             --disable-background-timer-throttling
             --disable-renderer-backgrounding
             --disable-backgrounding-occluded-windows
             "C:\path\to\red-vs-black\index.html"
(sound starts without clicking and Chrome never slows the game down)


URL OPTIONS (optional)
----------------------
Add after index.html, combine with &  (example: index.html?obs=1&interval=10)
  ?obs=1          hide gear button and on-screen notices (clean capture)
  ?interval=20    round interval in seconds: 10, 15, 20 or 30
  ?quality=low    animation quality: low, medium or high
  ?sound=0        start with sound effects off
  ?music=0        start with music off
  ?reset=1        start a brand-new game


ONLINE HOSTING (24/7 access)
----------------------------
Double-clicking index.html runs the game locally. For online access upload
the complete folder (index.html must stay next to the "assets" folder):

- Netlify:  app.netlify.com -> Add new site -> Deploy manually ->
            drag & drop the whole folder. Done.
- GitHub Pages: create a repository, upload all files keeping the folder
            structure, then Settings -> Pages -> Deploy from a branch ->
            main / (root). The included .nojekyll file is for GitHub Pages.
- Any static host (cPanel, Cloudflare Pages, Firebase Hosting, S3 ...):
            upload the files exactly as they are.
The same files work locally and online - no changes required.


FILES
-----
  index.html               main entry - open this file
  README.txt               this guide
  .nojekyll                (GitHub Pages helper, can be ignored)
  assets/css/style.css     layout, design and animations
  assets/css/fonts.css     embedded fonts (Cinzel & Montserrat, SIL OFL)
  assets/js/engine.js      52-card deck, secure shuffle, RED/BLACK rules
  assets/js/cards.js       realistic card face renderer
  assets/js/audio.js       sound manager
  assets/js/game.js        automatic game loop, animations, control panel
  assets/img/              background, card art, panels, icons (all local)
  assets/audio/            sound effects + lounge music loop (all local)
  assets/fonts/            original font files and their licenses


TECHNICAL NOTES
---------------
- Pure HTML5 + CSS3 + vanilla JavaScript. No modules, no fetch requests,
  no external libraries or CDNs - works from file:// and any web server.
- Timing uses the real clock: the countdown stays accurate even if the tab
  was in the background; when the tab becomes active again the screen
  re-syncs instantly.
- One single timer drives the game (no duplicate timers); temporary
  animation elements are removed automatically (no memory growth).
- Animations use GPU-friendly transform/opacity only.
- Screen wake lock is requested (where supported) so the display stays on.


DISCLAIMER
----------
This is a virtual entertainment game using points and statistics only.
It does not involve real money, betting, deposits, withdrawals or prizes.
