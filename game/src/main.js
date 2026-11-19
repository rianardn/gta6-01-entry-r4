// Solara Bay — main game: state machine, loop, combat, missions, save/load.
// Wires every system together. Rendering lives in render.js, HUD in hud.js.

import { WORLD, CAR_MODELS, ECONOMY } from './config.js';
import { makeRng, pick, range, chance, clamp, dist } from './rng.js';
import { generateCity, hitsBuilding, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createInput, attachInput, held, wasPressed, endFrame } from './input.js';
import { initAudio, resumeAudio, sfx, engineSound, sirenSound, startMusic } from './audio.js';
import { createPlayer, updatePlayer, playerShoot, damagePlayer, weaponDef } from './player.js';
import { createCar, updateCarPhysics, nearestCar, driveToward } from './vehicles.js';
import { createTraffic, createPedestrians, updateTraffic, updatePedestrians } from './traffic.js';
import { createWanted, crime, updateWanted, updateCops, clearWanted } from './police.js';
import { createMissions, startMission, updateMission, failMission, currentStep, startSideJob, STORY } from './missions.js';
import { createEconomy, shopNear, buyUpgrade, buyWeapon, buyAmmo, repairCar, healAtHospital, engineMult, carMaxHp, SHOPS } from './economy.js';
import { createSky, updateSky, gripFactor } from './weather.js';
import { createCamera, updateCamera, drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawEnd, drawComplete, drawShop, shopRows } from './hud.js';
import { shotParams, setupShot, autopilot } from './shots.js';

const SAVE_KEY = 'solara-bay-save-v1';

export function createGame(canvas) {
  const rng = makeRng(20261119);
  const city = generateCity(20261119);
  const player = createPlayer(-252, -120);
  player.busted = false;
  const g = {
    canvas, ctx: canvas.getContext('2d'),
    city, rng, sky: createSky(),
    player, wanted: createWanted(), missions: createMissions(),
    econ: { ...createEconomy(), shops: SHOPS },
    cars: [], peds: [], bullets: [], particles: [],
    cam: createCamera(), input: createInput(),
    time: 0, state: 'title', shop: null, shopSel: 0,
    hideHints: false, demo: false, stats: { missions: 0, time: 0 },
    mouseWorld: { x: 0, y: 0 },
  };
  g.enemies = g.missions.enemies;
  // ambient life
  g.cars = createTraffic(24, rng, city);
  g.peds = createPedestrians(56, rng, city);
  // parked cars around town
  const parked = ['sedan', 'hatch', 'coupe', 'van', 'taxi', 'muscle', 'sport'];
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint(rng, city);
    g.cars.push(createCar(pick(rng, parked), p.x, p.y, pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), { driver: null }));
  }
  // Mara's own starter car at the garage (on the road beside it)
  const starter = createCar('sedan', -252, -180, 0, { driver: null, engineMult: engineMult(g.econ) });
  g.cars.push(starter);
  attachInput(g.input, canvas);
  return g;
}

function spawnMissionCar(g, model, x, y) {
  const car = createCar(model, x, y, 0, { driver: null });
  car.missionCar = true;
  g.cars.push(car);
  return car;
}

function spawnEnemies(g, x, y, count) {
  for (let i = 0; i < count; i++) {
    g.missions.enemies.push({
      x: x + range(g.rng, -70, 70), y: y + range(g.rng, -70, 70),
      angle: 0, hp: 60, shootCd: range(g.rng, 0.3, 1.2), speed: 6.5,
    });
  }
}

function addParticles(g, kind, x, y, n) {
  for (let i = 0; i < n; i++) {
    g.particles.push({
      kind, x: x + range(g.rng, -6, 6), y: y + range(g.rng, -6, 6),
      vx: range(g.rng, -30, 30), vy: range(g.rng, -30, 30),
      life: 1, size: range(g.rng, 3, 8),
    });
  }
}

function screenToWorld(g, sx, sy) {
  const cam = g.cam;
  return {
    x: cam.x + sx / cam.zoom,
    y: cam.y + sy / cam.zoom,
  };
}

function enterCar(g, car) {
  const p = g.player;
  const copNear = g.wanted.cops.some((c) => {
    const cx = c.kind === 'car' ? c.car.x : c.x;
    const cy = c.kind === 'car' ? c.car.y : c.y;
    return dist(cx, cy, car.x, car.y) < 150;
  });
  if (car.driver === 'traffic') {
    crime(g.wanted, copNear ? 'stealSeen' : 'stealCar', g.time);
    // the driver flees on foot
    g.peds.push({ x: car.x + 14, y: car.y + 14, angle: 0, speed: 3, shirt: '#d0a35f', target: randomSidewalkPoint(g.rng, g.city), panic: 3, dead: false, wander: 5 });
    car.driver = null;
  }
  car.driver = 'player';
  car.engineMult = engineMult(g.econ);
  car.maxHp = carMaxHp(g.econ);
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  sfx.door();
}

function exitCar(g) {
  const p = g.player, car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 22;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 22;
  sfx.door();
}

function fireBullet(g, from, tx, ty, dmg, fromPlayer) {
  const a = Math.atan2(ty - from.y, tx - from.x);
  g.bullets.push({
    x: from.x + Math.cos(a) * 16, y: from.y + Math.sin(a) * 16,
    vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
    dmg, range: 520, fromPlayer, life: 1,
  });
  addParticles(g, 'muzzle', from.x + Math.cos(a) * 16, from.y + Math.sin(a) * 16, 1);
}

function updateBullets(g, dt) {
  const p = g.player;
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitsBuilding(g.city, b.x, b.y, 2)) { b.life = 0; addParticles(g, 'spark', b.x, b.y, 2); continue; }
    if (b.fromPlayer) {
      // hit peds
      for (const ped of g.peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 11) {
          ped.dead = true; b.life = 0;
          addParticles(g, 'blood', ped.x, ped.y, 6);
          crime(g.wanted, 'killPed', g.time);
          break;
        }
      }
      if (b.life <= 0) continue;
      // hit mission enemies
      for (const e of g.missions.enemies) {
        if (dist(b.x, b.y, e.x, e.y) < 12) {
          e.hp -= b.dmg; b.life = 0;
          addParticles(g, 'blood', e.x, e.y, 5);
          if (e.hp <= 0 && !e.dead) {
            e.dead = true;
            if (g.missions.active) g.missions.active.kills++;
            crime(g.wanted, 'killPed', g.time);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // hit cops
      for (const c of g.wanted.cops) {
        if (c.kind === 'foot') {
          if (dist(b.x, b.y, c.x, c.y) < 12) {
            c.hp -= b.dmg; b.life = 0;
            if (c.hp <= 0) { c.dead = true; crime(g.wanted, 'killCop', g.time); }
            break;
          }
        } else if (dist(b.x, b.y, c.car.x, c.car.y) < 22) {
          c.car.hp -= b.dmg; b.life = 0;
          if (c.car.hp <= 0) c.dead = true;
          break;
        }
      }
      if (b.life <= 0) continue;
      // hit traffic cars
      for (const car of g.cars) {
        if (car.driver === 'player') continue;
        if (dist(b.x, b.y, car.x, car.y) < 22) {
          car.hp -= b.dmg; b.life = 0;
          car.smoke = Math.min(1, car.smoke + 0.2);
          break;
        }
      }
    } else {
      // enemy bullet vs player
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      if (dist(b.x, b.y, px, py) < (p.inCar ? 22 : 11)) {
        b.life = 0;
        if (p.inCar) { p.inCar.hp -= b.dmg * 0.5; }
        else damagePlayer(p, b.dmg);
        addParticles(g, 'blood', px, py, 3);
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
  g.missions.enemies = g.missions.enemies.filter((e) => !e.dead);
}

function updateEnemies(g, dt) {
  const p = g.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const e of g.missions.enemies) {
    e.shootCd -= dt;
    const d = dist(e.x, e.y, px, py);
    e.angle = Math.atan2(py - e.y, px - e.x);
    if (d > 200) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (e.shootCd <= 0) {
      e.shootCd = 1.3;
      fireBullet(g, e, px, py, 7, false);
      sfx.enemyShoot();
    }
  }
}

function updateSideJob(g, dt) {
  const j = g.missions.sideJob;
  if (!j) return;
  const p = g.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  j.timer += dt;
  if (j.type === 'taxi') {
    if (j.stage === 0 && dist(px, py, j.x, j.y) < 46) {
      j.stage = 1;
      const dest = pick(g.rng, [[-1008, -1008], [1008, 252], [-252, 1008], [252, -1008], [1008, -1008]]);
      j.x = dest[0]; j.y = dest[1];
      j.text = 'Drop the fare off (follow the marker)';
      g.missions.dialog = { text: 'Fare: "Take me there — and step on it!"', until: g.time + 4 };
    } else if (j.stage === 1 && dist(px, py, j.x, j.y) < 46) {
      p.money += ECONOMY.taxiFare;
      sfx.cash();
      g.missions.dialog = { text: `Fare paid: $${ECONOMY.taxiFare}. Nice driving.`, until: g.time + 4 };
      g.missions.sideJob = null;
    }
  } else if (j.type === 'courier') {
    if (j.stage === 0 && dist(px, py, j.x, j.y) < 46) {
      j.stage = 1;
      const dest = pick(g.rng, [[1008, 1008], [-1008, -252], [252, 1008], [-1008, 1008]]);
      j.x = dest[0]; j.y = dest[1];
      j.text = 'Deliver the parcel (follow the marker)';
    } else if (j.stage === 1 && dist(px, py, j.x, j.y) < 46) {
      p.money += ECONOMY.courierPay;
      sfx.cash();
      g.missions.dialog = { text: `Delivery done: $${ECONOMY.courierPay}.`, until: g.time + 4 };
      g.missions.sideJob = null;
    }
  } else if (j.type === 'vigilante') {
    if (j.stage === 0) {
      j.stage = 1;
      spawnEnemies(g, j.x, j.y, 2);
      j.text = 'Stop the criminals (2 left)';
    } else if (g.missions.enemies.length === 0 && j.stage === 1) {
      p.money += ECONOMY.vigilantePay;
      sfx.cash();
      g.missions.dialog = { text: `Streets are safer: $${ECONOMY.vigilantePay}.`, until: g.time + 4 };
      g.missions.sideJob = null;
    }
  }
}

function saveGame(g) {
  const p = g.player;
  const data = {
    money: p.money, health: p.health, armor: p.armor,
    x: p.x, y: p.y, storyIndex: g.missions.storyIndex,
    done: g.missions.done, ownedUpgrades: g.econ.ownedUpgrades,
    ownedWeapons: g.econ.ownedWeapons, weapons: p.weapons, ammo: p.ammo,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

function loadGame(g) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = g.player;
    p.money = d.money; p.health = d.health; p.armor = d.armor;
    p.x = d.x; p.y = d.y;
    g.missions.storyIndex = d.storyIndex || 0;
    g.missions.done = d.done || [];
    g.econ.ownedUpgrades = d.ownedUpgrades || [];
    g.econ.ownedWeapons = d.ownedWeapons || ['fists', 'pistol'];
    p.weapons = d.weapons || { fists: true, pistol: true };
    p.ammo = d.ammo || { pistol: 60 };
    p.weapon = 'pistol';
    clearWanted(g.wanted);
    return true;
  } catch (e) { return false; }
}

function respawnAfterEnd(g, kind) {
  const p = g.player;
  const fine = kind === 'busted' ? 200 : 150;
  p.money = Math.max(0, p.money - fine);
  p.health = 100;
  p.armor = 0;
  p.dead = false; p.busted = false;
  p.inCar = null;
  p.x = -756; p.y = 1008; // safehouse corner
  clearWanted(g.wanted);
  g.missions.enemies = [];
  if (g.missions.active) failMission(g.missions);
  g.state = 'playing';
}

function stepMissions(g, dt) {
  const m = g.missions;
  if (!m.active) return;
  const before = currentStep(m);
  const res = updateMission(m, g.player, dt, g.time, {
    wantedStars: () => g.wanted.stars,
    onStep: (a) => {
      const s = currentStep(m);
      if (!s) return;
      if (s.type === 'combat') spawnEnemies(g, s.x, s.y, s.count);
      if (s.type === 'steal') spawnMissionCar(g, s.model, s.x, s.y);
      if (a.mission.id === 'm4' && s.type === 'escape') {
        // the crew job: cops are on us now
        g.wanted.heat = 130; g.wanted.stars = 3;
        g.missions.dialog = { text: 'Crew: "Go go go! Lose them!"', until: g.time + 4 };
      }
      sfx.phone();
    },
    onComplete: (pay) => {
      g.stats.missions++;
      sfx.missionDone();
      g.missions.dialog = { text: `Job done — $${pay} in the pocket.`, until: g.time + 5 };
      if (m.storyIndex >= STORY.length) g.state = 'complete';
    },
  });
  if (res === 'failed') {
    failMission(m);
    g.missions.dialog = { text: 'Job failed. Dex will pretend this never happened.', until: g.time + 5 };
  }
  // combat step: count kills via enemy deaths (handled in updateBullets)
  if (before && before.type === 'combat' && m.active) {
    const s = currentStep(m);
    if (s && s.type === 'combat') {
      // kills tracked on active
    }
  }
}

function updatePlaying(g, dt) {
  const p = g.player;
  const input = g.input;
  g.time += dt;
  g.stats.time += dt;
  updateSky(g.sky, dt);
  g.mouseWorld = screenToWorld(g, input.mouseX, input.mouseY);

  // pause
  if (wasPressed(input, 'escape')) { g.state = 'paused'; return; }

  // mission start at the garage (Dex)
  const nearGarage = dist(p.x, p.y, -220, -120) < 80 && !p.inCar;
  if (wasPressed(input, 'e') && nearGarage && !g.missions.active && g.missions.storyIndex < STORY.length) {
    const a = startMission(g.missions, g.missions.storyIndex);
    a.mission.steps[0] && null;
    g.missions.dialog.until = g.time + 9;
    sfx.phone();
    return;
  }
  // side jobs: 1 taxi, 2 courier, 3 vigilante
  if (!g.missions.active && !g.missions.sideJob) {
    if (wasPressed(input, '1')) startSideJob(g.missions, 'taxi', p);
    else if (wasPressed(input, '2')) startSideJob(g.missions, 'courier', p);
    else if (wasPressed(input, '3')) startSideJob(g.missions, 'vigilante', p);
  }
  // shops
  const shop = shopNear(p.x, p.y);
  if (shop && wasPressed(input, 'e') && !p.inCar) {
    g.shop = shop;
    g.shopSel = 0;
    g.state = 'shop';
    sfx.click();
    return;
  }

  // enter / exit car
  if (wasPressed(input, 'e')) {
    if (p.inCar) exitCar(g);
    else {
      const car = nearestCar(g.cars, p.x, p.y, 44);
      if (car) enterCar(g, car);
    }
  }

  // driving
  if (p.inCar) {
    const car = p.inCar;
    const grip = gripFactor(g.sky);
    let auto = null;
    if (g.demo) auto = autopilot(g, dt);
    const throttle = auto ? auto.throttle : (held(input, 'w', 'arrowup') ? 1 : held(input, 's', 'arrowdown') ? -1 : 0);
    const steer = auto ? auto.steer : (held(input, 'a', 'arrowleft') ? -1 : held(input, 'd', 'arrowright') ? 1 : 0);
    const handbrake = auto ? auto.handbrake : held(input, ' ');
    const res = updateCarPhysics(car, { throttle, steer, handbrake }, dt, g.city);
    if (res.crashed) {
      sfx.crash();
      g.cam.shake = 0.7;
      if (Math.abs(car.speed) > 20) crime(g.wanted, 'crashCop', g.time);
    }
    // drift smoke + skid marks
    if (handbrake && Math.abs(car.speed) > 12) {
      addParticles(g, 'smoke', car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 1);
      g.particles.push({ kind: 'skid', x: car.x, y: car.y, vx: -Math.cos(car.angle) * 14, vy: -Math.sin(car.angle) * 14, life: 4, size: 0 });
    }
    if (car.hp <= 0) {
      // car explodes
      addParticles(g, 'smoke', car.x, car.y, 14);
      addParticles(g, 'spark', car.x, car.y, 10);
      sfx.crash();
      g.cam.shake = 1;
      damagePlayer(p, 25);
      g.cars = g.cars.filter((c) => c !== car);
      p.inCar = null;
      p.x = car.x + 30; p.y = car.y + 30;
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    engineSound(Math.abs(car.speed) / 50, true);
  } else {
    updatePlayer(p, input, g.city, dt, g.mouseWorld);
    engineSound(0, false);
    // shooting
    if (input.mouseDown && p.cooldown <= 0) {
      const res = playerShoot(p, g.mouseWorld.x, g.mouseWorld.y);
      if (res && res.bullets) {
        for (const b of res.bullets) g.bullets.push(b);
        sfx.shoot();
        g.cam.shake = Math.max(g.cam.shake, 0.15);
        crime(g.wanted, 'shoot', g.time);
      } else if (res && res.empty) {
        sfx.click();
      }
    }
    // weapon switch
    if (wasPressed(input, 'q')) {
      const owned = Object.keys(p.weapons).filter((k) => p.weapons[k]);
      const i = owned.indexOf(p.weapon);
      p.weapon = owned[(i + 1) % owned.length];
      sfx.click();
    }
    if (wasPressed(input, '1') && false) { /* side jobs handled above */ }
  }

  // ambient life
  const gunfire = g.bullets.some((b) => b.fromPlayer);
  updateTraffic(g.cars.filter((c) => c.driver === 'traffic'), g.city, dt, g.rng, p, gunfire);
  updatePedestrians(g.peds, g.city, dt, g.rng, p, gunfire);
  updateEnemies(g, dt);
  updateBullets(g, dt);

  // police
  updateWanted(g.wanted, p, dt, g.time, g.city, g.rng);
  updateCops(g.wanted, p, dt, g.city, g.rng, (cop, tx, ty, dmg) => {
    const from = cop.kind === 'car' ? cop.car : cop;
    fireBullet(g, from, tx, ty, dmg, false);
    sfx.enemyShoot();
  });
  sirenSound(g.wanted.stars >= 2, dt);

  // particles
  for (const pt of g.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt * (pt.kind === 'skid' ? 0.25 : 1.2);
    if (pt.kind === 'smoke') pt.size += dt * 6;
  }
  g.particles = g.particles.filter((pt) => pt.life > 0);

  // missions + side jobs
  stepMissions(g, dt);
  updateSideJob(g, dt);

  // busted / wasted
  if (p.busted) { g.state = 'busted'; sfx.busted(); return; }
  if (p.dead) { g.state = 'wasted'; sfx.busted(); return; }

  // camera follows player / car
  const fx = p.inCar ? p.inCar.x : p.x;
  const fy = p.inCar ? p.inCar.y : p.y;
  updateCamera(g.cam, fx, fy, dt, g.canvas.width, g.canvas.height);
}

function draw(g) {
  const ctx = g.ctx;
  const W = g.canvas.width, H = g.canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (g.state === 'title') {
    drawTitle(ctx, W, H, g.time);
    return;
  }
  drawWorld(ctx, g, g.cam, W, H);
  if (g.state === 'playing' || g.state === 'paused' || g.state === 'shop') drawHUD(ctx, g, W, H);
  if (g.state === 'paused') drawPause(ctx, W, H);
  if (g.state === 'shop' && g.shop) drawShop(ctx, W, H, g.shop, shopRows(g.shop, g.player, g.econ), g.shopSel);
  if (g.state === 'busted') drawEnd(ctx, W, H, 'busted', { missions: g.stats.missions, money: g.player.money });
  if (g.state === 'wasted') drawEnd(ctx, W, H, 'wasted', { missions: g.stats.missions, money: g.player.money });
  if (g.state === 'complete') drawComplete(ctx, W, H, { missions: g.stats.missions, money: g.player.money, time: g.stats.time });
}

function handleShopInput(g) {
  const input = g.input;
  const rows = shopRows(g.shop, g.player, g.econ);
  if (wasPressed(input, 'arrowup', 'w')) { g.shopSel = (g.shopSel - 1 + rows.length) % rows.length; sfx.click(); }
  if (wasPressed(input, 'arrowdown', 's')) { g.shopSel = (g.shopSel + 1) % rows.length; sfx.click(); }
  if (wasPressed(input, 'e', 'escape')) { g.state = 'playing'; g.shop = null; return; }
  if (wasPressed(input, 'enter')) {
    const row = rows[g.shopSel];
    const id = row.action();
    let res = { ok: false };
    if (g.shop.kind === 'garage') res = buyUpgrade(g.econ, g.player, id);
    else if (g.shop.kind === 'gunstore') res = id === 'ammo' ? buyAmmo(g.player, g.player.weapon) : buyWeapon(g.econ, g.player, id);
    else if (g.shop.kind === 'repair') res = repairCar(g.player, g.player.inCar);
    else if (g.shop.kind === 'hospital') res = healAtHospital(g.player);
    else if (g.shop.kind === 'safehouse') {
      if (saveGame(g)) {
        g.player.health = Math.min(100, g.player.health + ECONOMY.safehouseHeal);
        res = { ok: true };
      }
    }
    if (res.ok) { sfx.cash(); g.state = 'playing'; g.shop = null; }
    else sfx.click();
  }
}

export function start(g) {
  const { shot, demo } = shotParams();
  g.demo = demo;
  if (shot >= 1 && shot <= 4) {
    setupShot(g, shot);
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const input = g.input;
    if (g.state === 'title') {
      g.time += dt;
      if (wasPressed(input, 'enter') || input.mousePressed) {
        initAudio(); resumeAudio(); startMusic();
        g.state = 'playing';
        g.missions.dialog = { text: 'Dex: "Mara! You\'re back. Come see me at the garage — I\'ve got work for you."', until: g.time + 9 };
        sfx.phone();
      }
    } else if (g.state === 'playing') {
      updatePlaying(g, dt);
    } else if (g.state === 'paused') {
      if (wasPressed(input, 'escape', 'enter')) g.state = 'playing';
      else if (wasPressed(input, 'r')) { location.reload(); }
      else if (wasPressed(input, 's')) { saveGame(g); sfx.cash(); }
      else if (wasPressed(input, 'l')) { loadGame(g); g.state = 'playing'; }
    } else if (g.state === 'shop') {
      handleShopInput(g);
    } else if (g.state === 'busted' || g.state === 'wasted') {
      if (wasPressed(input, 'enter')) respawnAfterEnd(g, g.state);
    } else if (g.state === 'complete') {
      if (wasPressed(input, 'enter')) g.state = 'playing';
    }
    draw(g);
    endFrame(input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Boot when the DOM is ready.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    const g = createGame(canvas);
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    start(g);
  });
}
