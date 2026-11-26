// Skyward Vale — DOM HUD: altitude, speed, heading compass strip, vertical speed,
// throttle, fuel gauge, wind, artificial horizon, score + combo, timer, objective.
import { WORLD } from './config.js';
import { terrainHeight } from './world.js';

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['alt', 'speed', 'vspeed', 'throttle', 'fuel', 'fuelbar', 'wind', 'score', 'combo',
      'timer', 'mode', 'objective', 'ring', 'tod', 'msg', 'horizon-ball', 'compass', 'plane', 'damage']) {
      this.el[id] = document.getElementById(id);
    }
    this.msgTimer = 0;
  }

  showMessage(text, seconds = 3) {
    if (!this.el.msg) return;
    this.el.msg.textContent = text;
    this.el.msg.style.opacity = '1';
    this.msgTimer = seconds;
  }

  tick(dt) {
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0 && this.el.msg) this.el.msg.style.opacity = '0';
    }
  }

  update(f, game) {
    const e = this.el;
    const ground = terrainHeight(f.pos.x, f.pos.z, f.seed);
    const agl = Math.max(0, f.pos.y - ground);
    if (e.alt) e.alt.textContent = `${Math.round(f.pos.y * 3.28)} ft`;
    if (e.speed) e.speed.textContent = `${Math.round(f.speed * 1.94)} kt`;
    if (e.vspeed) {
      const vs = f.verticalSpeed * 196.85;
      e.vspeed.textContent = `${vs >= 0 ? '+' : ''}${Math.round(vs)} fpm`;
      e.vspeed.style.color = vs < -500 ? '#ff7a6e' : '#bfe9ff';
    }
    if (e.throttle) e.throttle.textContent = `${Math.round(f.throttle * 100)}%`;
    if (e.fuel) e.fuel.textContent = `${Math.round(f.fuel)}%`;
    if (e.fuelbar) {
      e.fuelbar.style.width = `${Math.max(0, (f.fuel / f.def.fuel) * 100)}%`;
      e.fuelbar.style.background = f.fuel < 25 ? '#ff5a4e' : f.fuel < 50 ? '#ffb84d' : '#5ed68a';
    }
    if (e.wind) {
      const w = Math.hypot(f.wind.x, f.wind.z) * 1.94;
      const dir = Math.round(((Math.atan2(f.wind.x, f.wind.z) * 180) / Math.PI + 360) % 360);
      e.wind.textContent = `${dir}° ${Math.round(w)} kt${f.storm ? ' GUST' : ''}`;
    }
    if (e.score) e.score.textContent = String(game.score);
    if (e.combo) {
      e.combo.textContent = game.combo > 1 ? `COMBO x${game.combo}` : '';
      e.combo.style.opacity = game.combo > 1 ? '1' : '0';
    }
    if (e.timer) {
      const t = game.elapsed;
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(Math.floor(t % 60)).padStart(2, '0');
      e.timer.textContent = `${mm}:${ss}`;
    }
    if (e.mode) e.mode.textContent = game.modeName;
    if (e.objective) e.objective.textContent = game.objectiveText;
    if (e.ring) e.ring.textContent = game.mode === 'rings' || game.mode === 'storm'
      ? `RING ${game.ringIndex + 1}/${game.ringTotal}` : `AGL ${Math.round(agl * 3.28)} ft`;
    if (e.tod) e.tod.textContent = game.timeLabel;
    if (e.damage) e.damage.textContent = f.damage > 0 ? `DMG ${Math.round(f.damage)}%` : '';
    // Artificial horizon: ball rotates with roll, shifts with pitch.
    if (e['horizon-ball']) {
      e['horizon-ball'].style.transform =
        `rotate(${-f.roll * 57}deg) translateY(${f.pitch * 90}px)`;
    }
    if (e.plane) e.plane.style.transform = `rotate(${-f.roll * 57}deg)`;
    // Compass strip: heading in degrees, N/E/S/W ticks.
    if (e.compass) {
      const deg = Math.round(((f.heading * 180) / Math.PI % 360 + 360) % 360);
      const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const label = labels[Math.round(deg / 45) % 8];
      e.compass.textContent = `${label} ${String(deg).padStart(3, '0')}°`;
    }
  }
}
