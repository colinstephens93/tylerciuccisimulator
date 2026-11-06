// Small geometry helpers. Headings use three.js Y rotation: 0 faces +z (south).

// Local (lx, lz) offset in an object's frame -> world (x, z).
export function toWorld(x, z, rot, lx, lz) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

export function angleLerp(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

export function angleDiff(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
