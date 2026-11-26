// Skyward Vale — arcade flight model: throttle, pitch, roll, heading, fuel, wind,
// ground collision, stall, crash and respawn. Pure state, no rendering here.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { terrainHeight } from './world.js';

export function createFlight(def, seed = 7) {
  const groundY = terrainHeight(WORLD.runwayX, WORLD.runwayZ + 60, seed);
  return {
    def, seed,
    pos: new THREE.Vector3(WORLD.runwayX, groundY + 2, WORLD.runwayZ + 60),
    heading: 0,         // facing north, down the runway (-z)
    pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: def.fuel,
    verticalSpeed: 0,
    onGround: true,
    crashed: false, crashReason: '',
    damage: 0,
    wind: new THREE.Vector3(2, 0, 1),
    gust: 0,
    time: 0,
    lowPassCooldown: 0,
  };
}

export function resetToRunway(f, def) {
  const fresh = createFlight(def, f.seed);
  Object.assign(f, fresh);
}

/**
 * Advance the flight state by dt seconds.
 * input: { pitch: -1..1 (pull up positive), roll: -1..1, throttleDelta, brake, flaps }
 * events: list of strings pushed for the game layer ('stall', 'crash', 'lowpass', 'refuel').
 */
export function stepFlight(f, input, dt, events) {
  f.time += dt;
  if (f.crashed) return;
  const def = f.def;

  // Throttle and speed.
  f.throttle = THREE.MathUtils.clamp(f.throttle + input.throttleDelta * dt, 0, 1);
  const targetSpeed = f.throttle * def.maxSpeed;
  const accel = f.throttle > 0.05 ? def.accel : 6;
  f.speed += THREE.MathUtils.clamp(targetSpeed - f.speed, -accel * dt * 1.6, accel * dt);
  if (input.brake) f.speed = Math.max(0, f.speed - 26 * dt);
  if (input.flaps) f.speed = Math.max(0, f.speed - 10 * dt);

  // Wind gusts: slow wandering gust that pushes the nose and the airframe.
  f.gust = Math.sin(f.time * 0.5) * 0.6 + Math.sin(f.time * 1.7) * 0.4;
  const gustStrength = f.storm ? 1.6 : 0.5;
  const windX = f.wind.x + f.gust * gustStrength * 2.2;
  const windZ = f.wind.z + Math.cos(f.time * 0.8) * gustStrength * 1.4;

  // Pitch / roll with speed-dependent authority; on the ground only the rudder turns.
  const authority = THREE.MathUtils.clamp(f.speed / def.cruiseSpeed, 0.25, 1);
  if (f.onGround) {
    f.heading += input.roll * 0.5 * dt * (f.speed > 2 ? 1 : 0);
    // On the runway the pilot can rotate the nose up; it relaxes back when released.
    f.pitch = THREE.MathUtils.clamp(f.pitch + input.pitch * 1.2 * dt, -0.1, 0.5);
    if (Math.abs(input.pitch) < 0.05) f.pitch *= (1 - 2 * dt);
    f.roll *= 0.9;
  } else {
    f.pitch = THREE.MathUtils.clamp(f.pitch + input.pitch * 0.9 * dt * authority, -0.6, 0.6);
    f.roll = THREE.MathUtils.clamp(f.roll + input.roll * 1.4 * dt * authority, -1.1, 1.1);
    // Banked turn: heading follows the roll.
    f.heading += -f.roll * def.turnRate * dt * (0.4 + 0.6 * authority);
    // Pitch relaxes toward level when the stick is centred.
    if (Math.abs(input.pitch) < 0.05) f.pitch *= (1 - 0.4 * dt);
    if (Math.abs(input.roll) < 0.05) f.roll *= (1 - 0.8 * dt);
  }

  // Velocity from heading + pitch, plus wind drift.
  const forward = new THREE.Vector3(-Math.sin(f.heading), 0, -Math.cos(f.heading));
  const climb = Math.sin(f.pitch) * f.speed;
  // Lift: below stall speed the wing gives up and the plane sinks.
  const stalled = !f.onGround && f.speed < def.stallSpeed;
  const lift = stalled ? -9 : climb;
  if (stalled && !f.wasStalled) events.push('stall');
  f.wasStalled = stalled;
  f.verticalSpeed = lift;
  f.pos.addScaledVector(forward, f.speed * Math.cos(f.pitch) * dt);
  f.pos.y += lift * dt;
  f.pos.x += windX * dt * (f.onGround ? 0.15 : 1);
  f.pos.z += windZ * dt * (f.onGround ? 0.15 : 1);

  // Fuel burn scales with throttle; empty tank means the engine quits.
  if (f.throttle > 0.02 && f.fuel > 0) {
    f.fuel = Math.max(0, f.fuel - def.fuelBurn * (0.3 + f.throttle) * dt);
    if (f.fuel === 0) { f.throttle = 0; events.push('fuel-out'); }
  }

  // Ground contact.
  const ground = terrainHeight(f.pos.x, f.pos.z, f.seed);
  const gearH = 1.4;
  f.lowPassCooldown = Math.max(0, f.lowPassCooldown - dt);
  if (f.pos.y <= ground + gearH) {
    const onRunway = Math.abs(f.pos.x - WORLD.runwayX) < WORLD.runwayWidth / 2 + 4
      && Math.abs(f.pos.z - WORLD.runwayZ) < WORLD.runwayLength / 2 + 4;
    const touchdownVs = f.verticalSpeed;
    const level = Math.abs(f.pitch) < 0.22 && Math.abs(f.roll) < 0.35;
    if (f.onGround) {
      f.pos.y = ground + gearH;
    } else if (onRunway && touchdownVs > -7 && level && f.speed < def.maxSpeed * 0.85) {
      // A landing: roll out on the strip.
      f.onGround = true;
      f.pos.y = ground + gearH;
      f.pitch = 0; f.roll = 0;
      events.push('landed');
      f.landing = { vs: touchdownVs, x: f.pos.x, z: f.pos.z, speed: f.speed };
      f.fuel = def.fuel; // refuel on the ground
      events.push('refuel');
    } else if (onRunway && touchdownVs > -12 && level) {
      f.onGround = true; f.pos.y = ground + gearH; f.pitch = 0; f.roll = 0;
      f.damage += 25;
      events.push('hard-landing');
      f.fuel = def.fuel;
      events.push('refuel');
    } else {
      // Terrain strike.
      f.crashed = true;
      f.crashReason = f.pos.y < 2 ? 'Ditched in the sea' : 'Terrain strike';
      events.push('crash');
    }
  } else if (f.onGround && f.speed > def.stallSpeed + 6 && f.pitch > 0.08) {
    f.onGround = false; // rotation: lift off only when the pilot pulls up
    events.push('takeoff');
  }
  // Low pass: fast and close to the ground while airborne.
  if (!f.onGround && !f.crashed && f.pos.y - ground < 14 && f.speed > def.cruiseSpeed * 0.7 && f.lowPassCooldown <= 0) {
    f.lowPassCooldown = 4;
    events.push('lowpass');
  }
  // Keep the plane inside the world.
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > WORLD.size * 0.75) {
    const s = (WORLD.size * 0.75) / r;
    f.pos.x *= s; f.pos.z *= s;
    events.push('edge');
  }
  if (f.pos.y > 420) { f.pos.y = 420; f.pitch = Math.min(f.pitch, 0); }
}
