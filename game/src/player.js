// The player on foot: movement, health/armor, weapons, shooting, getting in cars.
// Pure movement math is exported for tests; rendering lives in render.js.

import { PLAYER, WEAPONS } from './config.js';
import { clamp, dist, angleTo } from './rng.js';
import { hitsBuilding } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.health, armor: 0,
    money: PLAYER.startMoney,
    weapon: 'pistol', weapons: { fists: true, pistol: true },
    ammo: { pistol: 60, smg: 0, shotgun: 0, rifle: 0 },
    cooldown: 0, inCar: null, dead: false, deadTimer: 0,
    runStamina: 1,
  };
}

export function weaponDef(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function playerShoot(p, tx, ty) {
  if (p.cooldown > 0 || p.inCar || p.dead) return null;
  const w = weaponDef(p.weapon);
  if (p.weapon !== 'fists' && (p.ammo[p.weapon] || 0) <= 0) return { empty: true };
  p.cooldown = 1 / w.rate;
  p.angle = angleTo(p.x, p.y, tx, ty);
  if (p.weapon !== 'fists') p.ammo[p.weapon]--;
  const spread = p.weapon === 'shotgun' ? 0.16 : p.weapon === 'smg' ? 0.09 : 0.03;
  const bullets = [];
  const count = p.weapon === 'shotgun' ? 5 : 1;
  for (let i = 0; i < count; i++) {
    const a = p.angle + (Math.random() - 0.5) * spread * 2;
    bullets.push({
      x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
      vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
      dmg: w.dmg, range: w.range, fromPlayer: true, life: w.range / 520,
    });
  }
  return { bullets };
}

export function damagePlayer(p, dmg) {
  if (p.dead) return;
  let left = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    p.deadTimer = 0;
  }
}

export function updatePlayer(p, input, city, dt, mouseWorld) {
  if (p.dead) { p.deadTimer += dt; return; }
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (p.inCar) return;

  const run = input.keys.has('shift');
  const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = 0, my = 0;
  if (input.keys.has('w') || input.keys.has('arrowup')) my -= 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) my += 1;
  if (input.keys.has('a') || input.keys.has('arrowleft')) mx -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    const nx = p.x + mx * sp * dt;
    const ny = p.y + my * sp * dt;
    // axis-separated collision so the player slides along walls
    if (!hitsBuilding(city, nx, p.y, 10)) p.x = nx;
    if (!hitsBuilding(city, p.x, ny, 10)) p.y = ny;
    p.speed = sp;
    p.angle = angleTo(p.x, p.y, p.x + mx, p.y + my);
  } else {
    p.speed = 0;
  }
  // aim at mouse when firing or holding right mouse
  if (input.mouseDown && mouseWorld) p.angle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);

  const half = 1260;
  p.x = clamp(p.x, -half + 20, half - 20);
  p.y = clamp(p.y, -half + 20, half - 20);
}
