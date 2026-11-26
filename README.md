# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

[![rank](https://make.fun/badge/best-flight-game-20261126-0057/daviddika/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

[![reward](https://make.fun/badge/best-flight-game-20261126-0057/daviddika/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Skyward Vale: an original Three.js 3D flight game set in a procedural island valley. Fly four modes — Free Flight, Ring Run, Precision Landing, and Storm Front — with fuel, wind, stall, and damage systems, three unlockable aircraft (Kestrel, Falcon, Albatross), keyboard and mouse controls, and chase and cockpit cameras. No build step and no network requests at runtime: it runs offline in a desktop browser.

## How to play

Pick a mode on the menu, then fly. Free Flight is open exploration (rings and low passes score points), Ring Run races 12 glowing rings through the valley, Precision Landing asks you to take off, fly the pattern, and grease it on the runway, and Storm Front runs the ring course in a dusk storm with gusts, rain, and 2x score. Watch your fuel, mind the wind, and don't stall. Earn score to unlock aircraft: Falcon at 1,500 and Albatross at 4,000.

Controls:

- Arrows — pitch & roll
- A/D — roll
- W/S — throttle
- Space — brake
- F — flaps
- C — camera (chase / cockpit)
- P — pause
- R — respawn
- M — mute
- T — time of day
- Mouse — steer while held

## Files

- `main.ts` — stages the entry for the judge (copies `game/` and `screenshots/`, writes `dossier.json`)
- `serve.ts` — tiny static server for local play (Node 22, standard library only)
- `game/` — the game itself: `index.html`, `style.css`, `src/` (world, flight, input, HUD, audio, aircraft), and vendored Three.js in `vendor/`
- `screenshots/` — four gameplay screenshots
- `vendor/makefun-game.ts` — vendored make.fun library used by `main.ts`
- `LICENSE` — MIT
- `.makefun/owner.json` — entry ownership record

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080

---

<sub>Entered on [make.fun](https://make.fun/?ref=dika-david&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
