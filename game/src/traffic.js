// Ambient life: traffic cars that follow the road grid and pedestrians on the
// sidewalks. They react to the player (horns, fleeing from gunfire).

import { CAR_MODELS } from './config.js';
import { makeRng, pick, range, chance, dist } from './rng.js';
import { randomRoadPoint, randomSidewalkPoint, nearestRoadPoint } from './city.js';
import { createCar, driveToward } from './vehicles.js';

const TRAFFIC_MODELS = ['sedan', 'hatch', 'taxi', 'van', 'truck', 'coupe', 'muscle'];

export function createTraffic(count, rng, city) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng, city);
    const vertical = chance(rng, 0.5);
    const car = createCar(pick(rng, TRAFFIC_MODELS), p.x, p.y, vertical ? Math.PI / 2 : 0, { driver: 'traffic' });
    car.target = pickTarget(rng, city);
    cars.push(car);
  }
  return cars;
}

function pickTarget(rng, city) {
  return randomRoadPoint(rng, city);
}

export function createPedestrians(count, rng, city) {
  const peds = [];
  const shirts = ['#e07a5f', '#5f8fd0', '#7ab86a', '#d0a35f', '#9a6fd0', '#d05f8a', '#5fb8c9'];
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(rng, city);
    peds.push({
      x: p.x, y: p.y, angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.2, 2.4), shirt: pick(rng, shirts),
      target: randomSidewalkPoint(rng, city),
      panic: 0, dead: false, wander: range(rng, 2, 8),
    });
  }
  return peds;
}

export function updateTraffic(cars, city, dt, rng, playerPos, gunfire) {
  for (const car of cars) {
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 24) {
      car.target = pickTarget(rng, city);
    }
    // panic: flee from gunfire near the player
    let tx = car.target.x, ty = car.target.y;
    if (gunfire && dist(car.x, car.y, playerPos.x, playerPos.y) < 200) {
      const away = Math.atan2(car.y - playerPos.y, car.x - playerPos.x);
      tx = car.x + Math.cos(away) * 200;
      ty = car.y + Math.sin(away) * 200;
    }
    // slow down for the car ahead (cheap: check the nearest other car in front)
    let slow = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (fwd > 0 && fwd < 34 && side < 10) { slow = true; break; }
    }
    driveToward(car, tx, ty, dt, city, { slowNear: slow ? 60 : 0 });
    if (car.hp <= 0) {
      // wrecked traffic car respawns elsewhere
      const p = randomRoadPoint(rng, city);
      car.x = p.x; car.y = p.y; car.hp = 100; car.speed = 0; car.smoke = 0;
      car.target = pickTarget(rng, city);
    }
  }
}

export function updatePedestrians(peds, city, dt, rng, playerPos, gunfire) {
  for (const p of peds) {
    if (p.dead) continue;
    if (gunfire && dist(p.x, p.y, playerPos.x, playerPos.y) < 260) p.panic = 3;
    p.panic = Math.max(0, p.panic - dt);
    const spd = p.panic > 0 ? p.speed * 2.6 : p.speed;
    if (dist(p.x, p.y, p.target.x, p.target.y) < 12 || p.wander <= 0) {
      p.target = randomSidewalkPoint(rng, city);
      p.wander = range(rng, 3, 9);
    }
    p.wander -= dt;
    let tx = p.target.x, ty = p.target.y;
    if (p.panic > 0) {
      const away = Math.atan2(p.y - playerPos.y, p.x - playerPos.x);
      tx = p.x + Math.cos(away) * 120;
      ty = p.y + Math.sin(away) * 120;
    }
    const a = Math.atan2(ty - p.y, tx - p.x);
    p.angle = a;
    p.x += Math.cos(a) * spd * dt;
    p.y += Math.sin(a) * spd * dt;
    const half = 1260;
    p.x = Math.max(-half + 12, Math.min(half - 12, p.x));
    p.y = Math.max(-half + 12, Math.min(half - 12, p.y));
  }
}
