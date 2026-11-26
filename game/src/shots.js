// Skyward Vale — deterministic screenshot staging for ?shot=start|rings|landing|dusk.
// Each scene puts the real game in a flown pose (autopilot trims the plane toward
// the next ring or the runway), renders twice, then sets window.__shotReady.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { terrainHeight, ringCourse } from './world.js';

function placePlane(game, x, y, z, heading, pitch, speed, throttle) {
  const f = game.flight;
  f.pos.set(x, y, z);
  f.heading = heading;
  f.pitch = pitch;
  f.roll = 0;
  f.speed = speed;
  f.throttle = throttle;
  f.onGround = false;
  f.crashed = false;
  f.fuel = f.def.fuel * 0.8;
}

function headingTo(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.atan2(-dx, -dz);
}

/** Stage one named scene on the live game instance; returns nothing. */
export function stageShot(name, game) {
  const seed = game.seed;
  const course = ringCourse(seed);
  if (name === 'rings' || name === 'dusk') {
    // Chase view: plane closing on ring 3 over the river valley, town and peaks behind.
    const target = course[2];
    const prev = course[1];
    const dir = new THREE.Vector3().subVectors(target, prev).normalize();
    const start = new THREE.Vector3().copy(target).addScaledVector(dir, -120);
    start.y = target.y + 10;
    game.startMode(name === 'dusk' ? 'storm' : 'rings', { silent: true });
    game.ringIndex = 2;
    game.updateRingHighlight();
    placePlane(game, start.x, start.y, start.z, headingTo(start, target), 0.02, 46, 0.75);
    game.score = name === 'dusk' ? 1250 : 650;
    game.combo = 3;
  } else if (name === 'landing') {
    // Final approach: gear down, runway lights ahead, town to the left.
    game.startMode('landing', { silent: true });
    const gy = terrainHeight(WORLD.runwayX, WORLD.runwayZ, seed);
    const approach = new THREE.Vector3(WORLD.runwayX + 6, gy + 46, WORLD.runwayZ + 260);
    placePlane(game, approach.x, approach.y, approach.z, 0, -0.09, 34, 0.35);
    game.score = 480;
    game.combo = 1;
  } else {
    // Cover: climbing out south of the airfield, town + runway + valley ahead.
    game.startMode('free', { silent: true });
    const gy = terrainHeight(WORLD.runwayX, WORLD.runwayZ, seed);
    const p = new THREE.Vector3(60, gy + 120, WORLD.runwayZ + 300);
    placePlane(game, p.x, p.y, p.z, -0.25, 0.08, 52, 0.85);
    game.score = 320;
    game.combo = 2;
  }
  if (name === 'dusk') game.setTimeOfDay(18.2);
  else if (name === 'landing') game.setTimeOfDay(10.5);
  else game.setTimeOfDay(name === 'rings' ? 14.0 : 9.0);
  // Fly the real physics forward a short beat so the prop spins and the
  // instruments settle, then paint twice for the screenshot.
  for (let i = 0; i < 12; i += 1) game.step(1 / 60, { pitch: 0, roll: 0, throttleDelta: 0, brake: false, flaps: false });
  game.render();
  game.render();
  // Keep the big centre toast out of the frame; the bottom mode line says it.
  const msg = document.getElementById('msg');
  if (msg) msg.style.opacity = '0';
  game.hud.msgTimer = 0;
  window.__shotReady = true;
}
