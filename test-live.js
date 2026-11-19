// Live loop test: runs the real game loop in Node with stubbed DOM/canvas,
// drives 60 simulated seconds of demo play (?shot=1&demo=1) and asserts the
// mission advances and nothing throws. node test-live.js

// ---- DOM stubs ----
const rafQueue = [];
let simNow = 0;
global.performance = { now: () => simNow };
global.requestAnimationFrame = (fn) => { rafQueue.push(fn); };
global.location = { search: '?shot=1&demo=1' };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'measureText') return () => ({ width: 50 });
      if (prop === 'getImageData') return () => ({ data: [] });
      return () => {};
    },
    set() { return true; },
  });
}
const canvasStub = {
  width: 1280, height: 800,
  getContext: () => makeCtx(),
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
};
global.window = {
  addEventListener: () => {}, removeEventListener: () => {},
  innerWidth: 1280, innerHeight: 800,
};
global.document = {
  getElementById: () => canvasStub,
  addEventListener: () => {},
};

const { createGame, start } = await import('./game/src/main.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

const g = createGame(canvasStub);
start(g);

// drive the loop: 60fps for 60 simulated seconds
const frames = 60 * 60;
for (let i = 0; i < frames; i++) {
  simNow += 1000 / 60;
  const fns = rafQueue.splice(0);
  for (const fn of fns) fn(simNow);
}
console.log('state:', g.state);
console.log('time:', g.time.toFixed(1), 's');
console.log('player at:', Math.round(g.player.x), Math.round(g.player.y));
console.log('mission step:', g.missions.active ? g.missions.active.step : 'none', 'done:', g.missions.done);
console.log('player money:', g.player.money);
console.log('wanted stars:', g.wanted.stars);
console.log('traffic cars:', g.cars.length, 'peds:', g.peds.length);
console.log('bullets:', g.bullets.length, 'particles:', g.particles.length);

check('game is playing', g.state === 'playing');
check('time advanced ~60s', g.time > 50);
check('mission 1 step advanced past pickup', g.missions.active ? g.missions.active.step >= 1 : g.missions.done.includes('m1'));
check('player moved from spawn', Math.abs(g.player.x - 880) > 5 || Math.abs(g.player.y - (-1008)) > 5);
check('traffic intact', g.cars.length >= 30);
check('peds intact', g.peds.length >= 40);

// ---- second scenario: on-foot shootout, fire a weapon, enemies shoot back ----
global.location.search = '?shot=3';
const g2 = createGame(canvasStub);
start(g2);
for (let i = 0; i < 60 * 20; i++) {
  simNow += 1000 / 60;
  const fns = rafQueue.splice(0);
  for (const fn of fns) fn(simNow);
}
console.log('\nshootout: enemies left:', g2.missions.enemies.length, 'player hp:', g2.player.health, 'bullets:', g2.bullets.length, 'state:', g2.state);
check('shootout runs without crash', g2.state === 'playing' || g2.state === 'wasted');
check('player took damage standing still', g2.player.health < 100);
check('enemies present', g2.missions.enemies.length > 0);

// ---- third scenario: night chase, cops spawn and chase ----
global.location.search = '?shot=2';
const g3 = createGame(canvasStub);
start(g3);
for (let i = 0; i < 60 * 15; i++) {
  simNow += 1000 / 60;
  const fns = rafQueue.splice(0);
  for (const fn of fns) fn(simNow);
}
console.log('\nchase: stars:', g3.wanted.stars, 'cops:', g3.wanted.cops.length, 'player in car:', !!g3.player.inCar);
check('chase stays wanted (2+ stars)', g3.wanted.stars >= 2);
check('cops spawned', g3.wanted.cops.length >= 2);
check('player still in car', !!g3.player.inCar);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
