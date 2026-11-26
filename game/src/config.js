// Skyward Vale — shared constants, aircraft definitions and mode catalogue.
export const WORLD = {
  size: 2600,          // terrain spans -1300..1300 on x and z
  seaLevel: 0,
  maxHeight: 260,      // mountain peaks
  runwayX: 0,          // airfield centre
  runwayZ: 420,
  runwayHeading: 0,    // runway runs north-south (along -z)
  runwayLength: 320,
  runwayWidth: 26,
};

export const PLANES = {
  kestrel: {
    id: 'kestrel', name: 'Kestrel', role: 'Trainer',
    color: 0xe8b13c, accent: 0x2b4a6f,
    maxSpeed: 62, cruiseSpeed: 42, accel: 9, climb: 16,
    turnRate: 0.55, fuelBurn: 0.55, fuel: 100, stallSpeed: 18,
    desc: 'Forgiving trainer. Gentle turns, sips fuel.',
  },
  falcon: {
    id: 'falcon', name: 'Falcon', role: 'Sport',
    color: 0xc23b2e, accent: 0x1d1d22,
    maxSpeed: 95, cruiseSpeed: 62, accel: 14, climb: 24,
    turnRate: 0.85, fuelBurn: 1.0, fuel: 100, stallSpeed: 24,
    desc: 'Fast sport plane. Sharp turns, thirsty engine.',
  },
  albatross: {
    id: 'albatross', name: 'Albatross', role: 'STOL',
    color: 0x3f7d5a, accent: 0xd8c98a,
    maxSpeed: 52, cruiseSpeed: 36, accel: 8, climb: 20,
    turnRate: 0.45, fuelBurn: 0.45, fuel: 140, stallSpeed: 12,
    desc: 'Short-takeoff bush plane. Huge fuel tank, lands anywhere.',
  },
};

export const UNLOCK_SCORE = { kestrel: 0, falcon: 1500, albatross: 4000 };

export const MODES = {
  free:    { id: 'free',    name: 'Free Flight',       desc: 'Explore the vale. Rings and low passes score points.' },
  rings:   { id: 'rings',   name: 'Ring Run',          desc: 'Race 12 glowing rings through the valley. Best time wins.' },
  landing: { id: 'landing', name: 'Precision Landing', desc: 'Take off, fly the pattern, grease it on the runway.' },
  storm:   { id: 'storm',   name: 'Storm Front',       desc: 'The ring course in a dusk storm. Gusts, rain, 2x score.' },
};

export const RING_COUNT = 12;
export const SCORE = { ring: 100, lowPass: 25, landingBase: 500, stormMultiplier: 2 };
export const STORAGE_KEY = 'skyward-vale-best-v1';
