// Economy: money, safehouse, garage upgrades, weapon shop, repair.
// Shops are zones on the map; standing in one opens its menu (handled by hud.js).

import { UPGRADES, WEAPONS, ECONOMY } from './config.js';

export const SHOPS = [
  { id: 'safehouse', name: 'Southside Safehouse', x: -780, y: 980, kind: 'safehouse', color: '#7ab86a' },
  { id: 'garage', name: 'Dex\'s Garage', x: -220, y: -120, kind: 'garage', color: '#d0a35f' },
  { id: 'gunstore', name: 'Ironworks Guns', x: -350, y: -350, kind: 'gunstore', color: '#c95f5f' },
  { id: 'repair', name: 'Quick Fix Auto', x: 350, y: -350, kind: 'repair', color: '#5f8fd0' },
  { id: 'hospital', name: 'Solara General', x: -350, y: 350, kind: 'hospital', color: '#e8e8e8' },
];

export function shopNear(x, y, radius = 70) {
  for (const s of SHOPS) {
    const dx = x - s.x, dy = y - s.y;
    if (dx * dx + dy * dy < radius * radius) return s;
  }
  return null;
}

export function createEconomy() {
  return { ownedUpgrades: [], ownedWeapons: ['fists', 'pistol'] };
}

export function buyUpgrade(econ, player, id) {
  const u = UPGRADES.find((q) => q.id === id);
  if (!u || econ.ownedUpgrades.includes(id)) return { ok: false, reason: 'already owned' };
  if (player.money < u.price) return { ok: false, reason: 'not enough cash' };
  player.money -= u.price;
  econ.ownedUpgrades.push(id);
  return { ok: true, upgrade: u };
}

export function buyWeapon(econ, player, id) {
  const w = WEAPONS.find((q) => q.id === id);
  if (!w || econ.ownedWeapons.includes(id)) return { ok: false, reason: 'already owned' };
  if (player.money < w.price) return { ok: false, reason: 'not enough cash' };
  player.money -= w.price;
  econ.ownedWeapons.push(id);
  player.weapons[id] = true;
  player.ammo[id] = id === 'smg' ? 120 : id === 'shotgun' ? 24 : id === 'rifle' ? 30 : 60;
  player.weapon = id;
  return { ok: true, weapon: w };
}

export function buyAmmo(player, id) {
  const w = WEAPONS.find((q) => q.id === id);
  if (!w || id === 'fists') return { ok: false };
  const cost = 40;
  if (player.money < cost) return { ok: false, reason: 'not enough cash' };
  player.money -= cost;
  player.ammo[id] = (player.ammo[id] || 0) + (id === 'smg' ? 90 : id === 'shotgun' ? 16 : id === 'rifle' ? 20 : 48);
  return { ok: true };
}

export function repairCar(player, car) {
  if (!car) return { ok: false, reason: 'no car' };
  if (player.money < ECONOMY.repairCost) return { ok: false, reason: 'not enough cash' };
  if (car.hp >= car.maxHp) return { ok: false, reason: 'already full health' };
  player.money -= ECONOMY.repairCost;
  car.hp = car.maxHp;
  car.smoke = 0;
  return { ok: true };
}

export function healAtHospital(player) {
  if (player.money < ECONOMY.hospitalCost) return { ok: false, reason: 'not enough cash' };
  if (player.health >= 100 && player.armor >= 50) return { ok: false, reason: 'already healthy' };
  player.money -= ECONOMY.hospitalCost;
  player.health = 100;
  player.armor = 50;
  return { ok: true };
}

export function engineMult(econ) {
  let m = 1;
  for (const id of econ.ownedUpgrades) {
    const u = UPGRADES.find((q) => q.id === id);
    if (u && u.apply === 'engine') m *= u.mult;
  }
  return m;
}

export function carMaxHp(econ) {
  let hp = 100;
  for (const id of econ.ownedUpgrades) {
    const u = UPGRADES.find((q) => q.id === id);
    if (u && u.apply === 'carhp') hp += u.add;
  }
  return hp;
}
