// Vehicles: arcade car physics, carjacking, car health, upgrades.
// Physics is pure math (testable in Node); spawning uses the city.

import { CAR_MODELS } from './config.js';
import { clamp, lerp, angleDiff, turnToward, dist } from './rng.js';
import { hitsBuilding, nearestRoadPoint } from './city.js';

export function carDef(id) {
  return CAR_MODELS.find((c) => c.id === id) || CAR_MODELS[0];
}

export function createCar(modelId, x, y, angle, opts = {}) {
  const def = carDef(modelId);
  return {
    model: modelId, def,
    x, y, angle, speed: 0,
    hp: opts.hp ?? 100, maxHp: opts.maxHp ?? 100,
    color: opts.color || def.color,
    engineMult: opts.engineMult ?? 1,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | null (parked)
    target: null, // traffic destination
    stuck: 0, honk: 0,
    smoke: 0,
  };
}

export function updateCarPhysics(car, input, dt, city) {
  // input: {throttle: -1..1, steer: -1..1, handbrake: bool}
  const def = car.def;
  const top = def.top * car.engineMult;
  const accel = def.accel * car.engineMult;
  const grip = car.driver === 'traffic' ? def.grip * 0.8 : def.grip;
  car.crashCd = Math.max(0, (car.crashCd || 0) - dt);

  if (input.handbrake) {
    car.speed = lerp(car.speed, 0, Math.min(1, 4 * dt));
  } else if (input.throttle > 0) {
    car.speed += accel * input.throttle * dt;
  } else if (input.throttle < 0) {
    // brake, then reverse slowly
    if (car.speed > 0.5) car.speed -= accel * 1.4 * dt;
    else car.speed = Math.max(-top * 0.35, car.speed + accel * 0.6 * dt);
  } else {
    car.speed = lerp(car.speed, 0, Math.min(1, 2.0 * dt));
  }
  car.speed = clamp(car.speed, -top * 0.4, top);

  const spd = Math.abs(car.speed);
  const steerAuthority = clamp(spd / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  const turnRate = 2.4 * grip / 2.8;
  car.angle += input.steer * turnRate * steerAuthority * dt * (input.handbrake ? 1.6 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // building collision: check the car's front and rear axle points, so the car
  // can use the full road width without wedging on the buildings beside it.
  // On impact the car stays where it was (no sinking into the wall) and takes
  // damage only once per hit — a crash cooldown stops the death spiral of
  // ramming the same wall sixty times a second.
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const hit = hitsBuilding(city, nx + fx * 16, ny + fy * 16, 4)
    || hitsBuilding(city, nx - fx * 16, ny - fy * 16, 4);
  if (hit) {
    if (car.crashCd <= 0 && Math.abs(car.speed) > 3) {
      car.hp -= Math.min(12, Math.abs(car.speed) * 0.4 + 2);
      car.smoke = Math.min(1, car.smoke + 0.3);
      car.crashCd = 0.5;
    }
    car.speed *= -0.35;
    return { crashed: true, building: hit };
  }
  car.x = nx;
  car.y = ny;
  const half = 1260;
  car.x = clamp(car.x, -half + 14, half - 14);
  car.y = clamp(car.y, -half + 14, half - 14);
  if (car.hp < 40) car.smoke = Math.min(1, car.smoke + dt * 0.1);
  return { crashed: false };
}

// Road-following steering: the next point to aim at so a car stays on the road
// grid instead of cutting diagonally through city blocks. If the target shares
// the car's road, aim straight at it; otherwise aim at the corner where the
// car's road meets the target's road (an L-shaped route along roads).
export function roadSteerTarget(car, tx, ty) {
  const half = 1260, step = 252;
  const vx = Math.round((car.x + half) / step) * step - half; // nearest vertical road
  const hy = Math.round((car.y + half) / step) * step - half; // nearest horizontal road
  const tvx = Math.round((tx + half) / step) * step - half;
  const thy = Math.round((ty + half) / step) * step - half;
  const dvx = Math.abs(car.x - vx), dhy = Math.abs(car.y - hy);
  if (dhy < 20 && Math.abs(ty - hy) < 20) return { x: tx, y: hy };
  if (dvx < 20 && Math.abs(tx - vx) < 20) return { x: vx, y: ty };
  if (dhy <= dvx) return { x: tvx, y: hy };
  return { x: vx, y: thy };
}

// Steer a car toward a target point (traffic + police AI share this).
export function driveToward(car, tx, ty, dt, city, opts = {}) {
  const aim = roadSteerTarget(car, tx, ty);
  const targetAngle = Math.atan2(aim.y - car.y, aim.x - car.x);
  const d = dist(car.x, car.y, tx, ty);
  const diff = angleDiff(car.angle, targetAngle);
  const steer = clamp(diff * 2.2, -1, 1);
  let throttle = 1;
  if (d < 30) throttle = 0.4;
  if (Math.abs(diff) > 1.9) throttle = -0.6; // too far off: reverse out
  if (opts.slowNear && d < opts.slowNear) throttle = 0.3;
  return updateCarPhysics(car, { throttle, steer, handbrake: false }, dt, city);
}

// Nearest car to a point within radius (for carjacking / entering).
export function nearestCar(cars, x, y, radius) {
  let best = null, bestD = radius * radius;
  for (const c of cars) {
    const dd = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (dd < bestD) { bestD = dd; best = c; }
  }
  return best;
}
