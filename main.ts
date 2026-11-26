// Skyward Vale — a 3D flight game for best-flight-game-20261126-0057 (Node 22, standard library only).
//
// The entry is the static game in game/ (game/index.html plus its ES modules, vendored three.js
// under game/vendor/, no network requests at runtime), played offline in a desktop browser.
// This file stages it for the judge: it copies game/ and screenshots/ next to this file into
// the output directory and writes dossier.json there, the summary the scorer reads, using the
// vendored make.fun library. Skyward Vale itself is a Three.js flight game: fly a glider through
// floating rings over a valley, land on the strip, chase dusk light; menu, HUD, rings, landing,
// day/dusk modes, and synthesized WebAudio wind and chimes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The directory this file lives in, resolved from its own module URL. */
const entryDir = dirname(fileURLToPath(import.meta.url));

/** Where the staged entry goes: /output inside the grader, or MAKEFUN_OUTPUT_DIR outside it. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The scorer's caps for this bounty (its reference/gate.json). Only text_max_bytes changes the
 * dossier's bytes; the rest make this program refuse an entry the scorer would refuse: more than
 * 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
 * total, or a path under game/ over 1000 bytes. game/ counts beside /output's own 1000-entry
 * cap, alongside screenshots/ and dossier.json.
 */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

/** Copy a directory tree when it exists, creating the destination first. */
function copyTree(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  if (existsSync(source)) {
    cpSync(source, destination, { recursive: true });
  }
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });

  // The playable game, then its screenshots (the first by name is the cover). The screenshots
  // directory is always created in the output even when the source folder is absent, so the
  // staged layout is the same either way.
  copyTree(join(entryDir, 'game'), join(outputDir, 'game'));
  copyTree(join(entryDir, 'screenshots'), join(outputDir, 'screenshots'));

  writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));
}

main();
