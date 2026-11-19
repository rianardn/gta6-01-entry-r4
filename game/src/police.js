// Wanted system + police AI. Heat rises with crimes, decays when the player lies
// low. Cops spawn at the edge of view and chase; at 4+ stars interceptors join,
// at 5 stars a helicopter circles overhead. Busted = caught on foot or in a
// stopped car; wasted = health hits zero.

import { WANTED } from './config.js';
import { clamp, dist, angleTo } from './rng.js';
import { createCar, driveToward } from './vehicles.js';
import { damagePlayer } from './player.js';

export function createWanted() {
  return { heat: 0, stars: 0, cops: [], heli: null, bustedTimer: 0, lastCrime: 0 };
}

export function starsForHeat(heat) {
  let s = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (heat >= WANTED.thresholds[i]) s = i;
  }
  return Math.min(WANTED.maxStars, s);
}

export function addHeat(w, amount, now) {
  w.heat = clamp(w.heat + amount, 0, 500);
  w.stars = starsForHeat(w.heat);
  w.lastCrime = now;
}

export function crime(w, kind, now) {
  const heat = {
    stealCar: 30, stealSeen: 45, shoot: 18, killPed: 55, killCop: 80,
    speeding: 4, crashCop: 25, assault: 20,
  }[kind] || 10;
  addHeat(w, heat, now);
}

export function updateWanted(w, player, dt, now, city, rng) {
  // decay when quiet: no crime recently and no cop within 160m
  const copNear = w.cops.some((c) => dist(c.x, c.y, player.x, player.y) < 170);
  if (now - w.lastCrime > 6 && !copNear) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSec * 60 * dt);
    w.stars = starsForHeat(w.heat);
  }
  // spawn cops to match the star level
  const want = WANTED.copCount[w.stars];
  while (w.cops.length < want) {
    w.cops.push(spawnCop(player, w.stars, rng));
  }
  while (w.cops.length > want) w.cops.pop();

  // helicopter at 5 stars
  if (w.stars >= 5 && !w.heli) w.heli = { angle: 0, x: player.x, y: player.y - 200 };
  if (w.stars < 5) w.heli = null;
  if (w.heli) {
    w.heli.angle += dt * 0.5;
    w.heli.x = player.x + Math.cos(w.heli.angle) * 190;
    w.heli.y = player.y + Math.sin(w.heli.angle) * 190;
  }
}

function spawnCop(player, stars, rng) {
  const a = rng() * Math.PI * 2;
  const d = 420 + rng() * 160;
  const x = player.x + Math.cos(a) * d;
  const y = player.y + Math.sin(a) * d;
  const interceptor = stars >= 4 && rng() < 0.5;
  if (interceptor) {
    const car = createCar('police', x, y, 0, { driver: 'police', color: '#1c2430' });
    car.def = { ...car.def, top: 50, accel: 30 };
    return { kind: 'car', car, hp: 100, shootCd: 0 };
  }
  if (rng() < 0.45) {
    const car = createCar('police', x, y, 0, { driver: 'police', color: '#20242c' });
    return { kind: 'car', car, hp: 100, shootCd: 0 };
  }
  return { kind: 'foot', x, y, angle: 0, hp: 60, shootCd: 0, speed: 8.5 };
}

export function updateCops(w, player, dt, city, rng, onShoot) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const cop of w.cops) {
    cop.shootCd = Math.max(0, (cop.shootCd || 0) - dt);
    if (cop.kind === 'car') {
      const car = cop.car;
      // ram the player's car, or block ahead of it
      const d = dist(car.x, car.y, px, py);
      let tx = px, ty = py;
      if (d < 60 && player.inCar) {
        // aim slightly ahead to intercept
        tx = px + (player.inCar ? Math.cos(player.inCar.angle) * 40 : 0);
        ty = py + (player.inCar ? Math.sin(player.inCar.angle) * 40 : 0);
      }
      driveToward(car, tx, ty, dt, city);
      // ram damage on contact
      if (player.inCar && d < 26) {
        player.inCar.hp -= 14 * dt;
        car.hp -= 4 * dt;
      }
      // shoot at the player when close and in the open
      if (d < 260 && cop.shootCd <= 0) {
        cop.shootCd = 1.4;
        if (onShoot) onShoot(cop, px, py, 8);
      }
      if (car.hp <= 0) {
        // wrecked cop car: remove it (respawn handled by count logic)
        cop.dead = true;
      }
    } else {
      // foot cop: run at the player, shoot when close
      const d = dist(cop.x, cop.y, px, py);
      const a = angleTo(cop.x, cop.y, px, py);
      cop.angle = a;
      if (d > 26) {
        cop.x += Math.cos(a) * cop.speed * dt;
        cop.y += Math.sin(a) * cop.speed * dt;
      }
      if (d < 200 && cop.shootCd <= 0) {
        cop.shootCd = 1.1;
        if (onShoot) onShoot(cop, px, py, 6);
      }
      // busted: foot cop reaches the player on foot
      if (!player.inCar && d < 16 && w.stars > 0) {
        w.bustedTimer += dt;
        if (w.bustedTimer > 1.2) player.busted = true;
      } else {
        w.bustedTimer = Math.max(0, w.bustedTimer - dt * 2);
      }
    }
  }
  w.cops = w.cops.filter((c) => !c.dead);
  // busted in a stopped car with cops touching it
  if (player.inCar && player.inCar.speed < 1 && w.stars > 0) {
    const touching = w.cops.some((c) => c.kind === 'car' && dist(c.car.x, c.car.y, player.inCar.x, player.inCar.y) < 30);
    if (touching) {
      w.bustedTimer += dt;
      if (w.bustedTimer > 2.5) player.busted = true;
    }
  }
}

export function clearWanted(w) {
  w.heat = 0; w.stars = 0; w.cops = []; w.heli = null; w.bustedTimer = 0;
}
