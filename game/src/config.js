// Solara Bay — tuning constants, world data, vehicle and weapon definitions.
// Every number the game balances on lives here, so one file tunes the whole game.

export const WORLD = {
  size: 2520, // world is size x size metres, origin at centre
  block: 252, // one city block, road to road
  road: 26, // road width
  sidewalk: 8,
};

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, tint: '#c9a86a', kind: 'old' },
  { name: 'Downtown', x: 1, y: 0, tint: '#7fa8c9', kind: 'downtown' },
  { name: 'North Hills', x: 2, y: 0, tint: '#8fae7d', kind: 'hills' },
  { name: 'Marina', x: 3, y: 0, tint: '#5fb8c9', kind: 'marina' },
  { name: 'Canal Row', x: 0, y: 1, tint: '#b98a5f', kind: 'canal' },
  { name: 'Midtown', x: 1, y: 1, tint: '#9aa5b1', kind: 'midtown' },
  { name: 'Verde Park', x: 2, y: 1, tint: '#5f9e5a', kind: 'park' },
  { name: 'Dockside', x: 3, y: 1, tint: '#8d7d6b', kind: 'docks' },
  { name: 'Beachfront', x: 0, y: 2, tint: '#e8c87a', kind: 'beach' },
  { name: 'South Park', x: 1, y: 2, tint: '#6fae6a', kind: 'park' },
  { name: 'Stadium District', x: 2, y: 2, tint: '#c97f5f', kind: 'stadium' },
  { name: 'Harbor Lights', x: 3, y: 2, tint: '#7d8fc9', kind: 'harbor' },
  { name: 'Fisherman\'s Wharf', x: 0, y: 3, tint: '#6ba8a0', kind: 'wharf' },
  { name: 'Southside', x: 1, y: 3, tint: '#a08a6a', kind: 'south' },
  { name: 'Airport Road', x: 2, y: 3, tint: '#8a94a0', kind: 'airport' },
  { name: 'The Strip', x: 3, y: 3, tint: '#d97fb8', kind: 'strip' },
];

export const LANDMARKS = [
  { name: 'Solara Stadium', bx: 1, by: 1, w: 190, h: 140, color: '#c97f5f' },
  { name: 'Marina Towers', bx: 3, by: -3, w: 170, h: 120, color: '#5fb8c9' },
  { name: 'City Hall', bx: -1, by: -3, w: 150, h: 110, color: '#7fa8c9' },
  { name: 'Ferry Terminal', bx: 3, by: 1, w: 160, h: 100, color: '#7d8fc9' },
  { name: 'Grand Solara Hotel', bx: 3, by: 3, w: 150, h: 130, color: '#d97fb8' },
  { name: 'Verde Park Lake', bx: 1, by: -1, w: 180, h: 130, color: '#4f8fd0' },
];

export const CAR_MODELS = [
  { id: 'sedan', name: 'Solano', top: 34, accel: 16, grip: 2.6, color: '#b8c4cc', price: 0 },
  { id: 'taxi', name: 'Bay Cab', top: 32, accel: 15, grip: 2.6, color: '#f2c230', price: 0 },
  { id: 'hatch', name: 'Pip', top: 30, accel: 18, grip: 2.9, color: '#e07a5f', price: 0 },
  { id: 'coupe', name: 'Viento', top: 42, accel: 22, grip: 3.0, color: '#c94f6d', price: 800 },
  { id: 'muscle', name: 'Torro GT', top: 44, accel: 24, grip: 2.4, color: '#3f6fb8', price: 1500 },
  { id: 'van', name: 'Mover', top: 28, accel: 12, grip: 2.2, color: '#8a94a0', price: 0 },
  { id: 'truck', name: 'Hauler', top: 26, accel: 11, grip: 2.0, color: '#6b7d5a', price: 0 },
  { id: 'sport', name: 'Falco S', top: 52, accel: 28, grip: 3.4, color: '#f2e230', price: 4000 },
  { id: 'police', name: 'Interceptor', top: 46, accel: 26, grip: 3.2, color: '#20242c', price: 0 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', dmg: 12, rate: 2.4, range: 26, price: 0, auto: false },
  { id: 'pistol', name: 'P9 Pistol', dmg: 22, rate: 3.2, range: 320, price: 250, auto: false },
  { id: 'smg', name: 'Kestrel SMG', dmg: 14, rate: 9, range: 280, price: 900, auto: true },
  { id: 'shotgun', name: 'Boomstick', dmg: 60, rate: 1.1, range: 170, price: 1200, auto: false },
  { id: 'rifle', name: 'Longshot Rifle', dmg: 45, rate: 2.0, range: 520, price: 2500, auto: false },
];

export const UPGRADES = [
  { id: 'engine1', name: 'Tuned Engine I', desc: '+15% top speed', price: 600, apply: 'engine', mult: 1.15 },
  { id: 'engine2', name: 'Tuned Engine II', desc: '+15% top speed', price: 1400, apply: 'engine', mult: 1.15 },
  { id: 'armor1', name: 'Plated Body I', desc: '+40 car health', price: 500, apply: 'carhp', add: 40 },
  { id: 'armor2', name: 'Plated Body II', desc: '+60 car health', price: 1100, apply: 'carhp', add: 60 },
  { id: 'vest', name: 'Kevlar Vest', desc: '+50 armor', price: 400, apply: 'armor', add: 50 },
];

export const PLAYER = {
  walkSpeed: 7.2,
  runSpeed: 11.5,
  health: 100,
  armorMax: 100,
  startMoney: 150,
};

export const WANTED = {
  decayPerSec: 0.02, // heat falls when no crime and no cop sees you
  maxStars: 5,
  // heat thresholds per star
  thresholds: [0, 25, 60, 120, 220, 380],
  copCount: [0, 2, 3, 4, 6, 8],
};

export const ECONOMY = {
  taxiFare: 60,
  courierPay: 90,
  vigilantePay: 120,
  repairCost: 80,
  hospitalCost: 150,
  safehouseHeal: 25,
};

export const DAY = {
  lengthSec: 360, // one full day/night cycle
  startHour: 16.5, // golden hour start — sunsets over the bay
};
