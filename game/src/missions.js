// Story missions + side jobs for Solara Bay.
// Mara Quinn, ex-getaway driver, is pulled back in by an old friend, Dex.
// Each mission is a small state machine: objective text, a target point, and a
// completion test. Side jobs (taxi, courier, vigilante) are repeatable.

import { dist } from './rng.js';

export const STORY = [
  {
    id: 'm1', title: 'Welcome Back', giver: 'Dex',
    intro: 'Dex: "Mara! You\'re back in Solara Bay. One job — pick up a package at the Marina and bring it to me. Easy money."',
    objective: 'Drive to the Marina pickup (yellow marker)',
    steps: [
      { type: 'goto', x: 980, y: -980, text: 'Pick up the package at the Marina' },
      { type: 'goto', x: -220, y: -120, text: 'Bring the package back to Dex at the garage' },
    ],
    pay: 400,
  },
  {
    id: 'm2', title: 'Hot Wheels', giver: 'Dex',
    intro: 'Dex: "The crew needs a fast car. Steal the yellow Falco S parked in Downtown — and don\'t let the cops see you take it."',
    objective: 'Steal the Falco S in Downtown',
    steps: [
      { type: 'steal', model: 'sport', x: -252, y: -1008, text: 'Steal the yellow Falco S' },
      { type: 'goto', x: -220, y: -120, text: 'Deliver it to the garage in Midtown' },
    ],
    pay: 700,
  },
  {
    id: 'm3', title: 'Dockside Trouble', giver: 'Rosa',
    intro: 'Rosa: "Rivals are shaking down my docks. Go to Dockside and clear them out. Bring a gun."',
    objective: 'Clear the rivals at Dockside',
    steps: [
      { type: 'goto', x: 980, y: -350, text: 'Reach the Dockside warehouse' },
      { type: 'combat', count: 4, x: 980, y: -350, text: 'Take out 4 rivals' },
      { type: 'goto', x: 980, y: -350, text: 'Collect the protection money' },
    ],
    pay: 900,
  },
  {
    id: 'm4', title: 'The Getaway', giver: 'Dex',
    intro: 'Dex: "Rosa\'s crew hit a bank on The Strip. You drive. Get them to the safehouse — and lose the cops."',
    objective: 'Pick up the crew, then lose a 3-star wanted level',
    steps: [
      { type: 'goto', x: 980, y: 980, text: 'Pick up the crew on The Strip' },
      { type: 'escape', stars: 3, text: 'Lose the cops (drop to 0 stars)' },
      { type: 'goto', x: -756, y: 1008, text: 'Reach the Southside safehouse' },
    ],
    pay: 1400,
  },
  {
    id: 'm5', title: 'Stadium Heist', giver: 'Rosa',
    intro: 'Rosa: "The stadium vault holds the weekend take. Grab the van, get in, get out. The whole city will be looking for you."',
    objective: 'Steal the vault van at the Stadium',
    steps: [
      { type: 'steal', model: 'van', x: 252, y: 378, text: 'Steal the vault van' },
      { type: 'goto', x: -756, y: 1008, text: 'Deliver the van to the safehouse' },
    ],
    pay: 1800,
  },
  {
    id: 'm6', title: 'Airport Run', giver: 'Dex',
    intro: 'Dex: "A buyer is landing at Airport Road in ten minutes. Deliver the package — fast, no cops, no crashes."',
    objective: 'Deliver to Airport Road before the timer runs out',
    steps: [
      { type: 'timed', x: 504, y: 1008, seconds: 75, text: 'Reach Airport Road in time' },
    ],
    pay: 1600,
  },
  {
    id: 'm7', title: 'The Informant', giver: 'Rosa',
    intro: 'Rosa: "Someone\'s been talking to the cops. The informant is hiding in North Hills. Find him. Make him stop."',
    objective: 'Hunt the informant in North Hills',
    steps: [
      { type: 'goto', x: 504, y: -1008, text: 'Search North Hills' },
      { type: 'combat', count: 5, x: 504, y: -1008, text: 'Deal with the informant and his guards' },
    ],
    pay: 2200,
  },
  {
    id: 'm8', title: 'Sunset Score', giver: 'Dex',
    intro: 'Dex: "One last job, Mara. The Grand Solara Hotel safe, tonight, at sunset. Pull this off and we\'re free forever."',
    objective: 'Hit the Grand Solara Hotel, then escape by boat',
    steps: [
      { type: 'goto', x: 980, y: 980, text: 'Reach the Grand Solara Hotel' },
      { type: 'combat', count: 6, x: 980, y: 980, text: 'Fight through hotel security' },
      { type: 'goto', x: 980, y: -350, text: 'Escape to the Ferry Terminal' },
    ],
    pay: 5000,
  },
];

export function createMissions() {
  return {
    storyIndex: 0, // next story mission to offer
    active: null, // {mission, step, ...}
    done: [],
    sideJob: null, // {type, ...}
    enemies: [], // mission enemies
    dialog: null, // {text, until}
  };
}

export function startMission(m, index) {
  const mission = STORY[index];
  m.active = {
    mission, step: 0, timer: 0,
    kills: 0, needKills: 0,
    pickedUp: false, delivered: false,
  };
  m.dialog = { text: mission.intro, until: 9 };
  return m.active;
}

export function currentStep(m) {
  if (!m.active) return null;
  return m.active.mission.steps[m.active.step] || null;
}

export function missionObjectiveText(m) {
  const s = currentStep(m);
  if (!s) return '';
  return s.text;
}

// Advance the active mission. Returns 'complete' | 'failed' | 'progress' | null.
export function updateMission(m, player, dt, now, helpers) {
  if (!m.active) return null;
  const a = m.active;
  const s = currentStep(m);
  if (!s) return null;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;

  if (s.type === 'goto') {
    if (dist(px, py, s.x, s.y) < 46) {
      a.step++;
      if (helpers.onStep) helpers.onStep(a);
    }
  } else if (s.type === 'steal') {
    if (player.inCar && player.inCar.model === s.model) {
      a.step++;
      if (helpers.onStep) helpers.onStep(a);
    }
  } else if (s.type === 'combat') {
    if (a.kills >= s.count) {
      a.step++;
      if (helpers.onStep) helpers.onStep(a);
    }
  } else if (s.type === 'escape') {
    if (helpers.wantedStars() === 0) {
      a.step++;
      if (helpers.onStep) helpers.onStep(a);
    }
  } else if (s.type === 'timed') {
    a.timer += dt;
    if (dist(px, py, s.x, s.y) < 46) {
      a.step++;
      if (helpers.onStep) helpers.onStep(a);
    } else if (a.timer > s.seconds) {
      return 'failed';
    }
  }

  if (a.step >= a.mission.steps.length) {
    const pay = a.mission.pay;
    player.money += pay;
    m.done.push(a.mission.id);
    m.active = null;
    m.storyIndex++;
    if (helpers.onComplete) helpers.onComplete(pay);
    return 'complete';
  }
  return 'progress';
}

export function failMission(m) {
  if (!m.active) return;
  m.active = null;
  m.enemies = [];
}

// ---- Side jobs (repeatable) ----
export function startSideJob(m, type, player) {
  const spots = {
    taxi: { x: 252, y: 378, text: 'Pick up the fare, then drop them off' },
    courier: { x: -1008, y: 350, text: 'Collect the parcel, deliver it across town' },
    vigilante: { x: -252, y: -252, text: 'A criminal is on the run — stop them' },
  };
  const s = spots[type];
  m.sideJob = { type, stage: 0, x: s.x, y: s.y, text: s.text, timer: 0 };
  return m.sideJob;
}

export function sideJobText(m) {
  if (!m.sideJob) return '';
  return m.sideJob.text;
}
