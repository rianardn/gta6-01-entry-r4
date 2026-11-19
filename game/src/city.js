// City generation for Solara Bay. Pure data: no DOM, no canvas — testable in Node.
// Layout: a 10x10 grid of blocks (block = 252m, road = 26m). The west edge is the
// beach and the bay; the east edge is the docks and airport road. Districts tint
// their blocks; landmarks occupy whole blocks.

import { WORLD, DISTRICTS, LANDMARKS } from './config.js';
import { makeRng, pick, range, rangeInt, chance } from './rng.js';

export function blockCenter(bx, by) {
  // block indices -5..4; centre of block (bx,by) in world coords.
  // World spans -1260..1260; block bx spans [bx*252, bx*252+252).
  return { x: bx * WORLD.block + WORLD.block / 2, y: by * WORLD.block + WORLD.block / 2 };
}

export function districtAt(bx, by) {
  // districts are laid out on a 4x4 grid of block-pairs
  const dx = Math.floor((bx + 5) / 2.5);
  const dy = Math.floor((by + 5) / 2.5);
  const d = DISTRICTS.find((q) => q.x === dx && q.y === dy);
  return d || DISTRICTS[5];
}

export function generateCity(seed = 1337) {
  const rng = makeRng(seed);
  const blocks = [];
  const buildings = [];
  const trees = [];
  const lamps = [];
  const roads = [];
  const half = WORLD.size / 2;

  // Road centrelines: 11 vertical + 11 horizontal, spaced one block apart.
  for (let i = 0; i <= 10; i++) {
    const c = -half + i * WORLD.block;
    roads.push({ x1: c, y1: -half, x2: c, y2: half, vertical: true });
    roads.push({ x1: -half, y1: c, x2: half, y2: c, vertical: false });
  }

  const landmarkBlocks = new Set(LANDMARKS.map((l) => l.bx + ',' + l.by));

  for (let bx = -5; bx < 5; bx++) {
    for (let by = -5; by < 5; by++) {
      const c = blockCenter(bx, by);
      const d = districtAt(bx, by);
      const key = bx + ',' + by;
      const lm = LANDMARKS.find((l) => l.bx === bx && l.by === by);

      if (lm) {
        // landmark occupies the whole block
        buildings.push({
          x: c.x - lm.w / 2, y: c.y - lm.h / 2, w: lm.w, h: lm.h,
          color: lm.color, hgt: 26, kind: 'landmark', name: lm.name,
          bx, by, district: d.name,
        });
        blocks.push({ bx, by, kind: 'landmark', district: d.name, x: c.x, y: c.y });
        continue;
      }

      if (d.kind === 'park') {
        // park block: lake or lawn with trees, a few paths
        blocks.push({ bx, by, kind: 'park', district: d.name, x: c.x, y: c.y });
        const n = rangeInt(rng, 14, 22);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: c.x + range(rng, -100, 100), y: c.y + range(rng, -100, 100),
            r: range(rng, 7, 13), shade: pick(rng, ['#3f7d3a', '#4f9440', '#5aa347']),
          });
        }
        if (chance(rng, 0.5)) {
          buildings.push({
            x: c.x - 22, y: c.y - 16, w: 44, h: 32, color: '#7fb8d8',
            hgt: 4, kind: 'pond', name: 'Pond', bx, by, district: d.name,
          });
        }
        continue;
      }

      if (d.kind === 'beach') {
        // beach block: sand, palms, no buildings
        blocks.push({ bx, by, kind: 'beach', district: d.name, x: c.x, y: c.y });
        const n = rangeInt(rng, 8, 14);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: c.x + range(rng, -105, 105), y: c.y + range(rng, -105, 105),
            r: range(rng, 6, 9), shade: '#3f8f4f', palm: true,
          });
        }
        continue;
      }

      // built block: 2-4 buildings with alleys between them
      blocks.push({ bx, by, kind: 'built', district: d.name, x: c.x, y: c.y });
      const tall = d.kind === 'downtown' || d.kind === 'midtown';
      const nB = rangeInt(rng, 2, 4);
      const slots = [
        { x: -58, y: -58 }, { x: 58, y: -58 }, { x: -58, y: 58 }, { x: 58, y: 58 },
      ];
      for (let i = 0; i < nB; i++) {
        const s = slots[i];
        const w = range(rng, 62, 96), h = range(rng, 62, 96);
        const hgt = tall ? range(rng, 18, 64) : range(rng, 8, 22);
        const palette = ['#b8a88f', '#a89a86', '#9aa5b1', '#c9b18a', '#8fa8b8', '#b89a7a', '#a8b09a'];
        buildings.push({
          x: c.x + s.x - w / 2, y: c.y + s.y - h / 2, w, h,
          color: pick(rng, palette), hgt, kind: tall ? 'tower' : 'house',
          name: '', bx, by, district: d.name,
        });
      }
      // street lamps at block corners
      for (const [lx, ly] of [[-112, -112], [112, -112], [-112, 112], [112, 112]]) {
        if (chance(rng, 0.75)) lamps.push({ x: c.x + lx, y: c.y + ly });
      }
    }
  }

  return { seed, blocks, buildings, trees, lamps, roads, size: WORLD.size, landmarkBlocks: [...landmarkBlocks] };
}

// Is a point inside any building (solid)? Used by movement + spawning.
export function hitsBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (b.kind === 'pond') continue;
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Nearest road centreline point to (x,y) — keeps traffic on roads.
export function nearestRoadPoint(x, y) {
  const half = WORLD.size / 2;
  const step = WORLD.block;
  // snap to nearest vertical and horizontal road line
  const vx = Math.round((x + half) / step) * step - half;
  const hy = Math.round((y + half) / step) * step - half;
  const dv = Math.abs(x - vx), dh = Math.abs(y - hy);
  if (dv < dh) return { x: vx, y, vertical: true };
  return { x, y: hy, vertical: false };
}

export function randomRoadPoint(rng, city) {
  const half = WORLD.size / 2;
  const vertical = chance(rng, 0.5);
  const line = -half + rangeInt(rng, 0, 10) * WORLD.block;
  const along = range(rng, -half + 40, half - 40);
  return vertical ? { x: line, y: along } : { x: along, y: line };
}

export function randomSidewalkPoint(rng, city) {
  const p = randomRoadPoint(rng, city);
  const off = WORLD.road / 2 + WORLD.sidewalk / 2 + range(rng, -2, 2);
  return { x: p.x + (chance(rng, 0.5) ? off : -off), y: p.y + (chance(rng, 0.5) ? off : -off) };
}
