// Skyward Vale — game glue: renderer, chase/cockpit camera, mode state machine,
// scoring, ring course, storm rain, crash/respawn, menu wiring and the main loop.
import * as THREE from 'three';
import { WORLD, PLANES, UNLOCK_SCORE, MODES, RING_COUNT, SCORE, STORAGE_KEY } from './config.js';
import { buildWorld, applyTimeOfDay, terrainHeight, ringCourse } from './world.js';
import { buildAircraft } from './aircraft.js';
import { createFlight, stepFlight, resetToRunway } from './flight.js';
import { SoundEngine } from './audio.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

function loadBest() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

class Game {
  constructor() {
    this.seed = seed;
    this.best = loadBest();
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.mode = 'free';
    this.modeName = MODES.free.name;
    this.objectiveText = 'Fly the rings, skim the valley floor.';
    this.ringIndex = 0;
    this.ringTotal = RING_COUNT;
    this.ringTimes = [];
    this.planeId = 'kestrel';
    this.cameraMode = 'chase';
    this.paused = false;
    this.state = 'menu'; // menu | flying | crashed | landed
    this.timeOfDay = 10;
    this.timeLabel = 'Day';
    this.crashTimer = 0;
    this.landingScored = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    document.getElementById('scene').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5dd);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 5000);
    this.world = buildWorld(this.scene, seed);
    this.course = ringCourse(seed);
    this.flight = createFlight(PLANES.kestrel, seed);
    this.plane = buildAircraft(PLANES.kestrel);
    this.scene.add(this.plane.group);

    this.sound = new SoundEngine();
    this.hud = new Hud();
    this.input = new Input();
    this.rain = this.buildRain();
    this.scene.add(this.rain.points);
    this.rain.points.visible = false;

    this.setTimeOfDay(this.timeOfDay);
    this.bindMenu();
    this.bindKeys();
    addEventListener('resize', () => this.onResize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  buildRain() {
    const count = 1600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = Math.random() * 120;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaac4dd, size: 0.45, transparent: true, opacity: 0.5 });
    return { points: new THREE.Points(geo, mat), count };
  }

  // ----- menu -----
  bindMenu() {
    const menu = document.getElementById('menu');
    const planeList = document.getElementById('planes');
    const renderPlanes = () => {
      planeList.innerHTML = '';
      for (const def of Object.values(PLANES)) {
        const unlocked = (this.best.score || 0) >= UNLOCK_SCORE[def.id];
        const b = document.createElement('button');
        b.className = 'plane-card' + (this.planeId === def.id ? ' selected' : '');
        b.innerHTML = `<b>${def.name}</b> <span>${def.role}</span><br>${def.desc}<br>` +
          (unlocked ? `<span class="ok">Ready to fly</span>` : `<span class="lock">Unlock at ${UNLOCK_SCORE[def.id]} best score</span>`);
        b.disabled = !unlocked;
        b.onclick = () => { this.planeId = def.id; this.swapPlane(); renderPlanes(); };
        planeList.appendChild(b);
      }
    };
    renderPlanes();
    document.querySelectorAll('#modes button').forEach((btn) => {
      btn.onclick = () => {
        this.sound.ensure();
        this.startMode(btn.dataset.mode);
      };
    });
    document.getElementById('tod-range').addEventListener('input', (e) => {
      this.setTimeOfDay(Number(e.target.value));
    });
    document.getElementById('best-line').textContent =
      `Best score: ${this.best.score || 0} · Best Ring Run: ${this.best.ringTime ? this.best.ringTime.toFixed(1) + 's' : '—'} · Best landing: ${this.best.landing || 0}`;
    menu.classList.add('visible');
  }

  swapPlane() {
    this.scene.remove(this.plane.group);
    this.plane = buildAircraft(PLANES[this.planeId]);
    this.scene.add(this.plane.group);
    this.flight.def = PLANES[this.planeId];
    this.flight.fuel = PLANES[this.planeId].fuel;
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && this.state === 'flying') this.togglePause();
      if (e.code === 'KeyC') this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
      if (e.code === 'KeyR' && this.state !== 'menu') this.respawn();
      if (e.code === 'KeyM') this.sound.toggleMute();
      if (e.code === 'KeyT') this.setTimeOfDay((this.timeOfDay + 4) % 24);
      if (e.code === 'Enter' && this.state === 'menu') this.startMode('free');
    });
  }

  // ----- modes -----
  startMode(mode, opts = {}) {
    this.mode = mode;
    this.modeName = MODES[mode].name;
    this.score = 0;
    this.combo = 1;
    this.elapsed = 0;
    this.ringIndex = 0;
    this.ringTimes = [];
    this.landingScored = false;
    this.flight.storm = mode === 'storm';
    this.rain.points.visible = mode === 'storm';
    if (mode === 'storm') {
      this.setTimeOfDay(18.2);
      this.objectiveText = '12 rings in the dusk storm. 2x score. Mind the gusts.';
    } else if (mode === 'rings') {
      this.objectiveText = 'Fly all 12 rings, gold ring is next. Beat the clock.';
    } else if (mode === 'landing') {
      this.objectiveText = 'Take off, fly the pattern, land on the centreline.';
    } else {
      this.objectiveText = 'Fly the rings, skim the valley floor for low passes.';
    }
    this.updateRingHighlight();
    this.state = 'flying';
    this.paused = false;
    if (!opts.silent) {
      document.getElementById('menu').classList.remove('visible');
      document.getElementById('hud').classList.add('visible');
      document.getElementById('banner').classList.remove('visible');
    }
    this.hud.showMessage(`${MODES[mode].name} — ${MODES[mode].desc}`, 4);
  }

  setTimeOfDay(hour) {
    this.timeOfDay = hour;
    this.timeLabel = applyTimeOfDay(this.world, this.scene, hour);
    const slider = document.getElementById('tod-range');
    if (slider) slider.value = String(hour);
    const label = document.getElementById('tod-label');
    if (label) label.textContent = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')} — ${this.timeLabel}`;
  }

  togglePause() {
    this.paused = !this.paused;
    this.hud.showMessage(this.paused ? 'Paused — P to resume' : 'Resumed', 1.5);
  }

  respawn() {
    resetToRunway(this.flight, PLANES[this.planeId]);
    this.combo = 1;
    this.state = 'flying';
    this.crashTimer = 0;
    document.getElementById('banner').classList.remove('visible');
    this.hud.showMessage('Back on the runway — throttle up and go.', 3);
  }

  saveBest() {
    this.best.score = Math.max(this.best.score || 0, this.score);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.best)); } catch { /* private mode */ }
  }

  updateRingHighlight() {
    this.world.rings.meshes.forEach((ring, i) => {
      ring.material.color.setHex(i === this.ringIndex ? 0xffe14d : i < this.ringIndex ? 0x5ed68a : 0x39d0ff);
    });
  }

  checkRing() {
    if (this.mode !== 'rings' && this.mode !== 'storm' && this.mode !== 'free') return;
    const target = this.course[this.ringIndex];
    const d = this.flight.pos.distanceTo(target);
    if (d < 15) {
      const mult = this.mode === 'storm' ? SCORE.stormMultiplier : 1;
      const gained = SCORE.ring * this.combo * mult;
      this.score += gained;
      this.combo = Math.min(8, this.combo + 1);
      this.comboTimer = 6;
      this.ringTimes.push(this.elapsed);
      this.sound.ringChime();
      this.hud.showMessage(`RING ${this.ringIndex + 1} +${gained}  (combo x${this.combo})`, 2);
      this.ringIndex += 1;
      if (this.ringIndex >= RING_COUNT) {
        this.finishRingRun();
      } else {
        this.updateRingHighlight();
      }
    }
  }

  finishRingRun() {
    const t = this.elapsed;
    const bonus = Math.max(0, Math.round((300 - t) * 5));
    this.score += bonus;
    if (!this.best.ringTime || t < this.best.ringTime) this.best.ringTime = t;
    this.saveBest();
    this.hud.showMessage(`COURSE CLEAR in ${t.toFixed(1)}s — time bonus +${bonus}!`, 6);
    this.objectiveText = `Course clear in ${t.toFixed(1)}s — press R to fly it again.`;
    this.ringIndex = 0;
    this.updateRingHighlight();
  }

  scoreLanding(landing) {
    if (this.landingScored) return;
    this.landingScored = true;
    const centre = Math.abs(landing.x - WORLD.runwayX);
    const centreScore = Math.max(0, 200 - centre * 8);
    const softScore = Math.max(0, 150 + landing.vs * 20);
    const speedScore = landing.speed < 45 ? 100 : 50;
    const total = Math.round(centreScore + softScore + speedScore);
    this.score += total;
    if (!this.best.landing || total > this.best.landing) this.best.landing = total;
    this.saveBest();
    const verdict = landing.vs > -3 ? 'Butter smooth!' : landing.vs > -6 ? 'Nice landing.' : 'Firm, but on the strip.';
    this.hud.showMessage(`${verdict} Landing +${total} (centre ${Math.round(centre)}m, ${Math.round(-landing.vs * 196.85)} fpm)`, 6);
    this.sound.touchdown();
    if (this.mode === 'landing') {
      this.objectiveText = `Landed: +${total} pts — press R to take off again.`;
    }
  }

  handleEvents(events) {
    for (const ev of events) {
      if (ev === 'crash') {
        this.state = 'crashed';
        this.crashTimer = 0;
        this.combo = 1;
        this.sound.crash();
        this.saveBest();
        const b = document.getElementById('banner');
        b.innerHTML = `<h2>CRASHED — ${this.flight.crashReason}</h2><p>Score ${this.score} · Best ${this.best.score || 0}</p><p>Press R to respawn at the airfield.</p>`;
        b.classList.add('visible');
      } else if (ev === 'landed' || ev === 'hard-landing') {
        if (this.flight.landing) this.scoreLanding(this.flight.landing);
        if (ev === 'hard-landing') this.hud.showMessage('Hard landing — airframe took 25% damage.', 3);
      } else if (ev === 'lowpass') {
        const mult = this.mode === 'storm' ? SCORE.stormMultiplier : 1;
        this.score += SCORE.lowPass * mult;
        this.sound.lowPassWhoosh();
        this.hud.showMessage(`LOW PASS +${SCORE.lowPass * mult}`, 1.5);
      } else if (ev === 'stall') {
        this.hud.showMessage('STALL — nose down, throttle up!', 2);
      } else if (ev === 'fuel-out') {
        this.hud.showMessage('FUEL EMPTY — glide to the runway!', 4);
      } else if (ev === 'refuel') {
        this.hud.showMessage('Refuelled on the ground.', 2);
      } else if (ev === 'takeoff') {
        this.hud.showMessage('Airborne!', 2);
      }
    }
  }

  // ----- per-frame -----
  step(dt, input) {
    if (this.state !== 'flying' || this.paused) return;
    this.elapsed += dt;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 1;
    const events = [];
    stepFlight(this.flight, input, dt, events);
    this.checkRing();
    this.handleEvents(events);
    this.sound.update(this.flight.throttle, this.flight.speed, !this.flight.onGround);
    // Propeller spin scales with throttle; nav lights blink.
    this.plane.prop.rotation.z += dt * (4 + this.flight.throttle * 60);
    const blink = Math.sin(this.flight.time * 6) > 0;
    this.plane.navLights.tail.material.color.setHex(blink ? 0xffffff : 0x442222);
    // Rain follows the plane in storm mode.
    if (this.rain.points.visible) {
      this.rain.points.position.set(this.flight.pos.x, this.flight.pos.y - 40, this.flight.pos.z);
      const pos = this.rain.points.geometry.attributes.position;
      for (let i = 0; i < this.rain.count; i += 1) {
        let y = pos.getY(i) - dt * 90;
        if (y < 0) y = 120;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    // Ring pulse on the next target.
    const next = this.world.rings.meshes[this.ringIndex];
    if (next) {
      const s = 1 + Math.sin(this.flight.time * 4) * 0.06;
      next.scale.setScalar(s);
      next.rotation.z += dt * 0.4;
    }
  }

  render() {
    const f = this.flight;
    const g = this.plane.group;
    g.position.copy(f.pos);
    g.rotation.order = 'YXZ';
    g.rotation.y = f.heading;
    g.rotation.z = f.roll;
    g.rotation.x = -f.pitch;
    // Camera: chase behind the plane, or cockpit.
    const forward = new THREE.Vector3(-Math.sin(f.heading), 0, -Math.cos(f.heading));
    const up = new THREE.Vector3(0, 1, 0);
    if (this.cameraMode === 'cockpit') {
      this.camera.position.copy(f.pos).addScaledVector(forward, 1.2).addScaledVector(up, 1.1);
      this.camera.lookAt(f.pos.clone().addScaledVector(forward, 40).addScaledVector(up, Math.sin(f.pitch) * 20));
    } else {
      const back = f.pos.clone().addScaledVector(forward, -15).addScaledVector(up, 4.5);
      // Keep the camera above the ground.
      const gy = terrainHeight(back.x, back.z, this.seed);
      back.y = Math.max(back.y, gy + 3);
      // Snap when far away (first frame, respawn, shot staging) so the camera
      // never shows the plane from the front or from half a world away.
      if (this.camera.position.distanceTo(back) > 40) this.camera.position.copy(back);
      else this.camera.position.lerp(back, 0.35);
      this.camera.lookAt(f.pos.clone().addScaledVector(forward, 26));
    }
    this.renderer.render(this.scene, this.camera);
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.input.update();
    if (this.input.wasPressed('KeyR') && this.state === 'crashed') this.respawn();
    this.hud.tick(dt);
    this.step(dt, {
      pitch: this.input.pitch,
      roll: this.input.roll,
      throttleDelta: this.input.throttleDelta,
      brake: this.input.brake,
      flaps: this.input.flaps,
    });
    if (this.state !== 'menu') this.render();
    if (this.state !== 'menu') this.hud.update(this.flight, this);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}

const game = new Game();
window.__game = game;
if (shotName) {
  document.getElementById('menu').classList.remove('visible');
  document.getElementById('hud').classList.add('visible');
  stageShot(shotName, game);
} else {
  // Menu backdrop: slow orbit over the valley so the title screen is alive.
  const menuCam = { angle: 0 };
  const menuTick = () => {
    if (game.state !== 'menu') return;
    menuCam.angle += 0.0004;
    const cx = Math.sin(menuCam.angle) * 500;
    const cz = 420 + Math.cos(menuCam.angle) * 500;
    game.camera.position.set(cx, 260, cz);
    game.camera.lookAt(0, 40, 300);
    game.renderer.render(game.scene, game.camera);
    requestAnimationFrame(menuTick);
  };
  menuTick();
}
