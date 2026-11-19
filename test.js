// Solara Bay self-test — runs in Node, no browser needed.
// node test.js  (exit 0 = all pass)

import { generateCity, hitsBuilding, blockCenter, districtAt, nearestRoadPoint } from './game/src/city.js';
import { makeRng, clamp, angleDiff, turnToward } from './game/src/rng.js';
import { createCar, updateCarPhysics, driveToward, nearestCar } from './game/src/vehicles.js';
import { createWanted, starsForHeat, crime, addHeat, clearWanted } from './game/src/police.js';
import { createMissions, startMission, updateMission, STORY, currentStep } from './game/src/missions.js';
import { createEconomy, buyUpgrade, buyWeapon, engineMult, carMaxHp, shopNear, SHOPS } from './game/src/economy.js';
import { createPlayer, damagePlayer, playerShoot, weaponDef } from './game/src/player.js';
import { createSky, updateSky, daylight, isNight, isGoldenHour, clockText } from './game/src/weather.js';
import { WORLD, CAR_MODELS, WEAPONS } from './game/src/config.js';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}
function eq(name, a, b) { check(name + ` (${a} === ${b})`, a === b); }
function near(name, a, b, eps = 0.01) { check(name + ` (${a} ~= ${b})`, Math.abs(a - b) < eps); }

// ---- rng ----
{
  const r1 = makeRng(42), r2 = makeRng(42);
  eq('rng deterministic', r1(), r2());
  const r = makeRng(7);
  const v = r();
  check('rng in [0,1)', v >= 0 && v < 1);
  eq('angleDiff wraps', Math.round(angleDiff(0, Math.PI * 2) * 1e6), 0);
  near('turnToward steps', turnToward(0, 1, 0.3), 0.3);
  eq('clamp high', clamp(9, 0, 5), 5);
}

// ---- city ----
{
  const city = generateCity(20261119);
  check('city has 100 blocks', city.blocks.length === 100);
  check('city has buildings', city.buildings.length > 150);
  check('city has trees', city.trees.length > 100);
  check('city has 22 roads', city.roads.length === 22);
  const c = blockCenter(0, 0);
  near('blockCenter x', c.x, 126, 1);
  near('blockCenter corner', blockCenter(-5, -5).x, -1134, 1);
  const d = districtAt(0, 0);
  check('districtAt returns a district', !!d && !!d.name);
  const b = city.buildings[0];
  check('hitsBuilding finds a building', !!hitsBuilding(city, b.x + b.w / 2, b.y + b.h / 2));
  check('hitsBuilding misses open road', !hitsBuilding(city, 0, 0));
  const rp = nearestRoadPoint(100, 130);
  check('nearestRoadPoint snaps to a road', rp.vertical === true || rp.vertical === false);
  const city2 = generateCity(20261119);
  eq('city deterministic', JSON.stringify(city.buildings.length), JSON.stringify(city2.buildings.length));
}

// ---- car physics ----
{
  const city = generateCity(1);
  const car = createCar('sedan', 0, 0, 0, { driver: 'player' });
  eq('car starts stopped', car.speed, 0);
  eq('car hp 100', car.hp, 100);
  for (let i = 0; i < 60; i++) updateCarPhysics(car, { throttle: 1, steer: 0, handbrake: false }, 1 / 60, city);
  check('car accelerates', car.speed > 10);
  check('car moves forward', car.x > 5);
  check('car under top speed', car.speed <= car.def.top + 0.01);
  const x0 = car.x;
  for (let i = 0; i < 120; i++) updateCarPhysics(car, { throttle: 0, steer: 0, handbrake: false }, 1 / 60, city);
  check('car coasts to near stop', Math.abs(car.speed) < 1);
  // steering turns the car
  const car2 = createCar('sport', 0, 0, 0, { driver: 'player' });
  for (let i = 0; i < 60; i++) updateCarPhysics(car2, { throttle: 1, steer: 1, handbrake: false }, 1 / 60, city);
  check('steering changes angle', Math.abs(car2.angle) > 0.2);
  // building collision: a lone building in an empty lot, car drives into it
  const lot = { buildings: [{ x: 0, y: 0, w: 60, h: 60, kind: 'house', color: '#999', hgt: 10 }] };
  const car3 = createCar('sedan', 30, -40, Math.PI / 2, { driver: 'player' });
  const before = car3.hp;
  for (let i = 0; i < 120; i++) updateCarPhysics(car3, { throttle: 1, steer: 0, handbrake: false }, 1 / 60, lot);
  check('crash damages car', car3.hp < before);
  check('crash stops the car', Math.abs(car3.speed) < 12);
  // nearestCar
  const cars = [createCar('sedan', 0, 0, 0), createCar('sedan', 100, 0, 0)];
  eq('nearestCar picks closest', nearestCar(cars, 5, 0, 50), cars[0]);
  eq('nearestCar respects radius', nearestCar(cars, 500, 0, 50), null);
}

// ---- wanted ----
{
  const w = createWanted();
  eq('wanted starts 0 stars', w.stars, 0);
  eq('starsForHeat 0', starsForHeat(0), 0);
  eq('starsForHeat 30 -> 1', starsForHeat(30), 1);
  eq('starsForHeat 130 -> 3', starsForHeat(130), 3);
  eq('starsForHeat 400 -> 5', starsForHeat(400), 5);
  crime(w, 'stealCar', 0);
  check('steal adds heat', w.heat > 0 && w.stars >= 1);
  addHeat(w, 500, 1);
  eq('heat caps at 5 stars', w.stars, 5);
  clearWanted(w);
  eq('clearWanted resets', w.stars, 0);
  eq('clearWanted heat 0', w.heat, 0);
}

// ---- missions ----
{
  eq('story has 8 missions', STORY.length, 8);
  const m = createMissions();
  const p = createPlayer(0, 0);
  const a = startMission(m, 0);
  eq('mission starts', a.mission.id, 'm1');
  check('first step is goto', currentStep(m).type === 'goto');
  // teleport to the first objective and advance
  p.x = 980; p.y = -980;
  let res = updateMission(m, p, 0.1, 0, { wantedStars: () => 0 });
  check('goto step advances', currentStep(m).type === 'goto');
  p.x = -220; p.y = -120;
  res = updateMission(m, p, 0.1, 0, { wantedStars: () => 0, onComplete: () => {} });
  eq('mission completes', res, 'complete');
  check('mission recorded done', m.done.includes('m1'));
  check('payout added', p.money > 150);
  eq('story advances', m.storyIndex, 1);
  // timed mission fails when the clock runs out
  const m2 = createMissions();
  startMission(m2, 5); // m6 airport run, 75s
  const p2 = createPlayer(0, 0);
  let r2 = null;
  for (let i = 0; i < 80; i++) r2 = updateMission(m2, p2, 1, i, { wantedStars: () => 0 });
  eq('timed mission fails on timeout', r2, 'failed');
}

// ---- economy ----
{
  const econ = createEconomy();
  const p = createPlayer(0, 0);
  p.money = 5000;
  const r1 = buyUpgrade(econ, p, 'engine1');
  check('buy engine upgrade', r1.ok === true);
  near('engine mult 1.15', engineMult(econ), 1.15);
  const r2 = buyUpgrade(econ, p, 'engine1');
  check('cannot buy twice', r2.ok === false);
  const r3 = buyWeapon(econ, p, 'smg');
  check('buy smg', r3.ok === true && p.weapons.smg === true);
  check('smg ammo loaded', p.ammo.smg === 120);
  near('carMaxHp base+armor', carMaxHp(econ), 100);
  buyUpgrade(econ, p, 'armor1');
  near('carMaxHp with armor', carMaxHp(econ), 140);
  const poor = createPlayer(0, 0);
  poor.money = 10;
  check('poor player cannot buy', buyWeapon(createEconomy(), poor, 'rifle').ok === false);
  const s = shopNear(-780, 980);
  check('shopNear finds safehouse', s && s.id === 'safehouse');
  check('shopNear misses far away', shopNear(0, 0) === null);
  check('5 shops defined', SHOPS.length === 5);
}

// ---- player ----
{
  const p = createPlayer(0, 0);
  eq('player health 100', p.health, 100);
  damagePlayer(p, 30);
  eq('damage reduces health', p.health, 70);
  p.armor = 50;
  damagePlayer(p, 20);
  check('armor absorbs part', p.health > 58 && p.health < 70);
  const w = weaponDef('smg');
  eq('smg is auto', w.auto, true);
  const res = playerShoot(p, 100, 0);
  check('shoot returns bullets', res && res.bullets && res.bullets.length === 1);
  check('shoot spends ammo', p.ammo.pistol === 59);
  const p2 = createPlayer(0, 0);
  p2.ammo.pistol = 0;
  const res2 = playerShoot(p2, 100, 0);
  check('empty gun reports empty', res2 && res2.empty === true);
}

// ---- weather ----
{
  const sky = createSky();
  check('starts golden hour', isGoldenHour(sky));
  const t = clockText(sky);
  check('clock text format', /^\d\d:\d\d$/.test(t));
  const dl = daylight(sky);
  check('daylight in range', dl > 0 && dl <= 1);
  sky.hour = 23;
  check('night at 23:00', isNight(sky));
  check('dark at night', daylight(sky) < 0.2);
  sky.hour = 12;
  check('noon is bright', daylight(sky) > 0.9);
  updateSky(sky, 10);
  check('time advances', sky.hour > 12);
}

// ---- config sanity ----
{
  check('9 car models', CAR_MODELS.length === 9);
  check('5 weapons', WEAPONS.length === 5);
  check('world size 2520', WORLD.size === 2520);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
