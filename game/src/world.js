// Skyward Vale — procedural island valley: terrain heightfield, coastline and sea,
// river, runway airfield, lit town, mountains, clouds and the glowing ring course.
import * as THREE from 'three';
import { WORLD, RING_COUNT } from './config.js';
import { fbm, mulberry32 } from './random.js';

const VALLEY_HALF = 250;   // valley floor half-width around x = 0
const RUNWAY_FLAT_R = 260; // flattened apron around the airfield

/** Ground height at (x, z) for a given seed. Valley floor near x=0, mountains at the sides. */
export function terrainHeight(x, z, seed = 7) {
  const r = Math.hypot(x, z) / (WORLD.size / 2);
  const coast = THREE.MathUtils.smoothstep(r, 0.72, 1.05); // 0 inland, 1 out at sea
  const valley = Math.exp(-(x * x) / (VALLEY_HALF * VALLEY_HALF * 2.2));
  const hills = fbm(x * 0.004 + 13, z * 0.004 + 7, seed);
  const peaks = Math.pow(fbm(x * 0.002 + 40, z * 0.002 + 3, seed + 5), 2.2);
  let h = 12 + hills * 30 + peaks * (WORLD.maxHeight - 40);
  h *= (1 - valley * 0.92);                 // carve the valley
  h += 6 * Math.sin(z * 0.01) * valley;     // gentle valley undulation
  const flat = Math.exp(-((x - WORLD.runwayX) ** 2 + (z - WORLD.runwayZ) ** 2) / (RUNWAY_FLAT_R * RUNWAY_FLAT_R));
  h *= (1 - flat * 0.96);
  h += flat * 8;                            // airfield plateau
  return THREE.MathUtils.lerp(h, -14, coast); // sink below the sea at the edges
}

export function groundColor(h, slope, seed) {
  const c = new THREE.Color();
  if (h < 2) c.setHex(0xd9c98a);            // beach sand
  else if (h < 38) c.setHex(0x5d8a46);      // valley grass
  else if (h < 85) c.setHex(0x4a7a3c);      // hillside green
  else if (h < 140) c.setHex(0x7d8a6a);     // scrub rock
  else if (h < 195) c.setHex(0x8a8d90);     // high rock
  else c.setHex(0xf2f4f6);                  // snow peaks
  if (slope > 0.7 && h > 60) c.setHex(0x6b6252); // steep cliffs
  const jitter = 0.92 + 0.16 * fbm(h * 0.3, seed * 0.7, seed);
  c.multiplyScalar(jitter);
  return c;
}

function buildTerrain(scene, seed) {
  const segments = 150;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z, seed);
    pos.setY(i, h);
    const hx = terrainHeight(x + 6, z, seed) - h;
    const hz = terrainHeight(x, z + 6, seed) - h;
    const slope = Math.hypot(hx, hz) / 6;
    col.copy(groundColor(h, slope, seed));
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({ color: 0x1d6f9e, shininess: 120, specular: 0x88bbdd, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);
  return sea;
}

function buildRiver(scene, seed) {
  // A winding ribbon down the valley floor, from the north hills to the sea.
  const points = [];
  for (let z = -1150; z <= 1150; z += 60) {
    const x = 60 * Math.sin(z * 0.004 + 1.2) + 20 * Math.sin(z * 0.013);
    points.push(new THREE.Vector3(x, 0, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 80, 9, 6, false);
  geo.scale(1, 0.12, 1);
  const mat = new THREE.MeshPhongMaterial({ color: 0x2f8fc4, shininess: 140, specular: 0xaaddff, transparent: true, opacity: 0.92 });
  const river = new THREE.Mesh(geo, mat);
  river.position.y = 3.4;
  scene.add(river);
  return river;
}

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(0, 0, 64, 96);
  const rnd = mulberry32(99);
  for (let y = 8; y < 88; y += 16) {
    for (let x = 8; x < 56; x += 14) {
      ctx.fillStyle = rnd() > 0.45 ? '#ffd98a' : '#20242e';
      ctx.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildTown(scene, seed) {
  const rnd = mulberry32(seed * 31 + 5);
  const group = new THREE.Group();
  const tex = windowTexture();
  const wallMat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x554411, emissiveMap: tex, emissiveIntensity: 0.55 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a4a3a });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const roof = new THREE.ConeGeometry(0.75, 0.6, 4);
  for (let i = 0; i < 64; i += 1) {
    const x = 90 + rnd() * 260 - (rnd() > 0.5 ? 0 : 330);
    const z = 300 + rnd() * 320;
    const w = 10 + rnd() * 14, d = 10 + rnd() * 14, h = 9 + rnd() * 16;
    const gy = terrainHeight(x, z, seed);
    if (gy < 4) continue;
    // Skip steep slopes so houses sit on flat ground, not hillsides.
    if (Math.abs(terrainHeight(x + 12, z, seed) - terrainHeight(x - 12, z, seed)) > 5) continue;
    const house = new THREE.Mesh(box, wallMat);
    house.scale.set(w, h, d);
    house.position.set(x, gy + h / 2, z);
    house.rotation.y = (rnd() - 0.5) * 0.6;
    group.add(house);
    const r = new THREE.Mesh(roof, roofMat);
    r.scale.set(w, 1, d);
    r.position.set(x, gy + h + 0.3, z);
    r.rotation.y = house.rotation.y + Math.PI / 4;
    group.add(r);
  }
  // Church tower with a warm beacon light.
  const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 42, 12), wallMat);
  tower.position.set(120, terrainHeight(120, 470, seed) + 21, 470);
  group.add(tower);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  );
  beacon.position.set(120, terrainHeight(120, 470, seed) + 44, 470);
  group.add(beacon);
  scene.add(group);
  return group;
}

function buildAirfield(scene, seed) {
  const group = new THREE.Group();
  const gy = terrainHeight(WORLD.runwayX, WORLD.runwayZ, seed);
  const stripMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.runwayWidth, WORLD.runwayLength), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(WORLD.runwayX, gy + 0.4, WORLD.runwayZ);
  strip.receiveShadow = true;
  group.add(strip);
  // Centreline dashes and threshold bars.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5e8 });
  for (let z = WORLD.runwayZ - WORLD.runwayLength / 2 + 24; z < WORLD.runwayZ + WORLD.runwayLength / 2 - 10; z += 28) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 14), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(WORLD.runwayX, gy + 0.5, z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let i = -2; i <= 2; i += 1) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 12), lineMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(WORLD.runwayX + i * 4.6, gy + 0.5, WORLD.runwayZ + end * (WORLD.runwayLength / 2 - 14));
      group.add(bar);
    }
  }
  // Edge lights along the runway.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let z = WORLD.runwayZ - WORLD.runwayLength / 2; z <= WORLD.runwayZ + WORLD.runwayLength / 2; z += 32) {
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(WORLD.runwayX + side * (WORLD.runwayWidth / 2 + 2), gy + 1, z);
      group.add(l);
    }
  }
  // Hangars and control tower beside the strip.
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0x8a94a6 });
  for (const [hx, hz] of [[-46, 380], [-46, 440], [48, 400]]) {
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 34), hangarMat);
    hangar.position.set(hx, gy + 7, hz);
    group.add(hangar);
  }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 30, 10), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }));
  tower.position.set(52, gy + 15, 470);
  group.add(tower);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 5, 10), new THREE.MeshLambertMaterial({ color: 0x2b4a6f, emissive: 0x224466, emissiveIntensity: 0.8 }));
  cab.position.set(52, gy + 32, 470);
  group.add(cab);
  // Windsock on a pole.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 12, 6), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
  pole.position.set(-30, gy + 6, WORLD.runwayZ - 100);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2e }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-26, gy + 11, WORLD.runwayZ - 100);
  group.add(sock);
  scene.add(group);
  return { group, groundY: gy };
}

function buildClouds(scene, seed) {
  const rnd = mulberry32(seed * 7 + 13);
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x5a5f6e, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 26; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rnd() * 4);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 18, 10, 8), i > 19 ? darkMat : mat);
      s.position.set((rnd() - 0.5) * 60, (rnd() - 0.5) * 6, (rnd() - 0.5) * 30);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set((rnd() - 0.5) * 2200, 190 + rnd() * 120, (rnd() - 0.5) * 2200);
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

/** The 12-ring course: down the valley, over the river, around the peaks, home to the runway. */
export function ringCourse(seed = 7) {
  const pts = [];
  const rnd = mulberry32(seed * 17 + 3);
  const path = [
    [0, 420, 55], [-90, 180, 60], [70, -40, 70], [-120, -260, 85], [60, -480, 95],
    [-60, -700, 110], [130, -880, 120], [-40, -1020, 105], [90, -820, 95], [-110, -560, 80],
    [40, -300, 65], [0, 60, 55],
  ];
  for (const [x, z, alt] of path) {
    const gy = terrainHeight(x, z, seed);
    pts.push(new THREE.Vector3(x, Math.max(alt, gy + 28), z));
  }
  return pts.slice(0, RING_COUNT);
}

function buildRings(scene, seed) {
  const group = new THREE.Group();
  const meshes = [];
  const geo = new THREE.TorusGeometry(13, 1.1, 10, 36);
  ringCourse(seed).forEach((p, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe14d : 0x39d0ff });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(p);
    // Face along the course direction.
    const next = ringCourse(seed)[(i + 1) % RING_COUNT];
    ring.lookAt(next.x, next.y, next.z);
    group.add(ring);
    meshes.push(ring);
  });
  scene.add(group);
  return { group, meshes };
}

export function buildWorld(scene, seed = 7) {
  const terrain = buildTerrain(scene, seed);
  const sea = buildSea(scene);
  const river = buildRiver(scene, seed);
  const town = buildTown(scene, seed);
  const airfield = buildAirfield(scene, seed);
  const clouds = buildClouds(scene, seed);
  const rings = buildRings(scene, seed);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(400, 600, 200);
  scene.add(sun);
  scene.fog = new THREE.Fog(0xa8c6e0, 700, 2600);
  return { terrain, sea, river, town, airfield, clouds, rings, hemi, sun };
}

/** Move the sun and sky for a time of day (0..24). Returns a label for the HUD. */
export function applyTimeOfDay(world, scene, hour) {
  const t = ((hour % 24) + 24) % 24;
  const day = t >= 6 && t < 18;
  const dusk = (t >= 17 && t < 19.5) || (t >= 5 && t < 6.5);
  const angle = ((t - 6) / 12) * Math.PI;
  const elev = Math.sin(angle);
  world.sun.position.set(Math.cos(angle) * 800, Math.max(40, elev * 700), 300);
  if (dusk) {
    world.sun.color.setHex(0xff9a4d);
    world.sun.intensity = 1.1;
    world.hemi.intensity = 0.45;
    scene.background = new THREE.Color(0x2e3a5e);
    scene.fog.color.setHex(0x4a4460);
  } else if (day) {
    world.sun.color.setHex(0xfff2d0);
    world.sun.intensity = 1.6;
    world.hemi.intensity = 0.9;
    scene.background = new THREE.Color(0x87b5dd);
    scene.fog.color.setHex(0xa8c6e0);
  } else {
    world.sun.color.setHex(0x8fa8d8);
    world.sun.intensity = 0.25;
    world.hemi.intensity = 0.25;
    scene.background = new THREE.Color(0x0d1526);
    scene.fog.color.setHex(0x141c30);
  }
  return dusk ? 'Dusk' : day ? 'Day' : 'Night';
}
