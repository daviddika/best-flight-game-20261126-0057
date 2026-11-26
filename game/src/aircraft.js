// Skyward Vale — low-poly aircraft built from three.js primitives.
// One builder, three silhouettes: Kestrel trainer, Falcon sport, Albatross STOL.
import * as THREE from 'three';

function makeMaterials(color, accent) {
  return {
    body: new THREE.MeshLambertMaterial({ color }),
    accent: new THREE.MeshLambertMaterial({ color: accent }),
    dark: new THREE.MeshLambertMaterial({ color: 0x22242a }),
    glass: new THREE.MeshPhongMaterial({ color: 0x1a2f45, shininess: 160, specular: 0x99ccff }),
    metal: new THREE.MeshLambertMaterial({ color: 0x9aa2ad }),
  };
}

/** Build a plane group. Forward is -Z, up is +Y. Returns { group, prop, navLights }. */
export function buildAircraft(def) {
  const m = makeMaterials(def.color, def.accent);
  const g = new THREE.Group();
  const scale = def.id === 'albatross' ? 1.15 : def.id === 'falcon' ? 0.92 : 1.0;

  // Fuselage: tapered cylinder nose-to-tail.
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 6.4, 12), m.body);
  fus.rotation.x = Math.PI / 2;
  fus.position.z = 0.4;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), m.body);
  nose.scale.set(1, 1, 1.4);
  nose.position.z = -2.8;
  g.add(nose);
  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), m.glass);
  canopy.scale.set(0.9, 0.75, 1.9);
  canopy.position.set(0, 0.62, -0.9);
  g.add(canopy);
  // Main wing.
  const wingSpan = def.id === 'albatross' ? 11.5 : def.id === 'falcon' ? 7.6 : 9.2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.22, 1.9), m.accent);
  wing.position.set(0, -0.05, -0.4);
  g.add(wing);
  // Wing tip stripes.
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.9), m.body);
    tip.position.set(s * (wingSpan / 2 - 0.25), -0.05, -0.4);
    g.add(tip);
  }
  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.2), m.accent);
  stab.position.set(0, 0.15, 3.2);
  g.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), m.accent);
  fin.position.set(0, 0.85, 3.2);
  g.add(fin);
  // Landing gear (fixed, STOL gets bigger wheels).
  const wheelR = def.id === 'albatross' ? 0.55 : 0.42;
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), m.metal);
    strut.position.set(s * 0.9, -0.9, -0.6);
    g.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 12), m.dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.9, -1.35, -0.6);
    g.add(wheel);
  }
  // Propeller hub + two blades (spins in the render loop).
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), m.metal);
  prop.add(hub);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.1), m.dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  prop.position.set(0, 0, -3.7);
  g.add(prop);
  // Navigation lights: red port, green starboard, white tail.
  const navLights = {};
  const lightDefs = [
    ['port', -wingSpan / 2, 0xff2e2e], ['starboard', wingSpan / 2, 0x2eff5e], ['tail', 0, 0xffffff],
  ];
  for (const [name, x, color] of lightDefs) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    lamp.position.set(name === 'tail' ? 0 : x, 0, name === 'tail' ? 3.7 : -0.4);
    g.add(lamp);
    navLights[name] = lamp;
  }
  // Registration stripe on the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 2.2), m.accent);
  stripe.position.set(0, -0.1, 1.6);
  g.add(stripe);

  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, prop, navLights };
}
