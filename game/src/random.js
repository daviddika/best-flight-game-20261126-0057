// Skyward Vale — small seeded random helpers so terrain, town and ring courses
// are identical for a given seed (screenshots use ?seed=N).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashNoise(x, z, seed) {
  const s = Math.sin(x * 12.9898 + z * 78.233 + seed * 0.731) * 43758.5453;
  return s - Math.floor(s);
}

export function smoothNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hashNoise(xi, zi, seed), b = hashNoise(xi + 1, zi, seed);
  const c = hashNoise(xi, zi + 1, seed), d = hashNoise(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, seed) {
  let value = 0, amp = 1, freq = 1;
  for (let i = 0; i < 4; i += 1) {
    value += amp * smoothNoise(x * freq, z * freq, seed + i * 101);
    amp *= 0.5; freq *= 2.1;
  }
  return value;
}
