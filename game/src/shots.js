// Screenshot scenes + autopilot. The game reads ?shot=N from the URL:
//   shot=1  golden-hour Marina drive with a mission marker
//   shot=2  3-star night chase with police converging
//   shot=3  on-foot Dockside shootout with mission enemies
//   shot=4  night on The Strip, rain, neon
// ?demo=1 plays itself (autopilot drives toward the mission marker).
// These scenes exist only to show the game at its best; normal play ignores them.

import { createCar, roadSteerTarget } from './vehicles.js';
import { startMission } from './missions.js';

export function shotParams() {
  const q = new URLSearchParams(location.search);
  const shot = parseInt(q.get('shot') || '0', 10);
  return { shot, demo: q.get('demo') === '1' };
}

export function setupShot(g, shot) {
  const { player, missions, wanted, sky, city } = g;
  if (shot === 1) {
    // golden hour drive along the Marina
    sky.hour = 17.4; sky.weather = 'clear'; sky.rain = 0;
    const car = createCar('coupe', 880, -1008, 0, { driver: 'player' });
    g.cars.push(car);
    player.inCar = car;
    player.x = car.x; player.y = car.y;
    startMission(missions, 0);
    missions.dialog = null;
    g.cam.zoom = 0.85;
  } else if (shot === 2) {
    // night chase, 3 stars
    sky.hour = 21.5; sky.weather = 'clear'; sky.rain = 0;
    const car = createCar('muscle', -100, 100, 0, { driver: 'player' });
    g.cars.push(car);
    player.inCar = car;
    player.x = car.x; player.y = car.y;
    wanted.heat = 120; wanted.stars = 3;
    wanted.cops = [];
    startMission(missions, 3);
    missions.dialog = null;
    // pre-place 3 cop cars converging
    const spots = [[-260, 40], [60, 220], [-40, -140]];
    for (const [x, y] of spots) {
      const cop = createCar('police', x, y, 0, { driver: 'police' });
      g.cars.push(cop);
      wanted.cops.push({ kind: 'car', car: cop, hp: 100, shootCd: 0 });
    }
    g.cam.zoom = 0.8;
  } else if (shot === 3) {
    // Dockside shootout on foot
    sky.hour = 11.0; sky.weather = 'clear'; sky.rain = 0;
    player.x = 900; player.y = -300;
    player.weapon = 'smg';
    player.ammo.smg = 120;
    startMission(missions, 2);
    missions.dialog = null;
    // mission enemies in a loose line
    const spots = [[980, -380], [1030, -300], [960, -240], [1080, -340]];
    for (const [x, y] of spots) {
      missions.enemies.push({ x, y, angle: Math.PI, hp: 60, shootCd: 0.5, speed: 6 });
    }
    missions.active.kills = 1;
    g.cam.zoom = 0.9;
  } else if (shot === 4) {
    // night rain on The Strip
    sky.hour = 22.5; sky.weather = 'rain'; sky.rain = 0.8;
    const car = createCar('sport', 1008, 880, -Math.PI / 2, { driver: 'player' });
    g.cars.push(car);
    player.inCar = car;
    player.x = car.x; player.y = car.y;
    startMission(missions, 7);
    missions.dialog = null;
    g.cam.zoom = 0.85;
  }
  g.state = 'playing';
  g.hideHints = true;
  // snap the camera straight onto the player so the first frame is framed
  const vw = g.canvas.width || 1280, vh = g.canvas.height || 800;
  const fx = player.inCar ? player.inCar.x : player.x;
  const fy = player.inCar ? player.inCar.y : player.y;
  g.cam.x = fx - vw / 2 / g.cam.zoom;
  g.cam.y = fy - vh / 2 / g.cam.zoom;
}

// Autopilot: drives the player's car toward the mission marker, used by demo
// mode and by the screenshot scenes so the frames show motion.
export function autopilot(g, dt) {
  const { player, missions } = g;
  if (!player.inCar) return;
  const step = missions.active ? missions.active.mission.steps[missions.active.step] : null;
  if (!step || step.x === undefined) return;
  const car = player.inCar;
  const tx = step.x, ty = step.y;
  const dx = tx - car.x, dy = ty - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) return;
  // steer along the road grid, not straight through the blocks
  const aim = roadSteerTarget(car, tx, ty);
  const targetAngle = Math.atan2(aim.y - car.y, aim.x - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2));
  // slow for corners
  const throttle = Math.abs(diff) > 0.9 ? 0.4 : 1;
  return { throttle, steer, handbrake: false };
}
