// Synthesised sound: WebAudio oscillators + noise, no audio files.
// Everything is guarded so importing this module in Node (tests) is safe.

let ctx = null;
let master = null;
let musicTimer = null;
let engineOsc = null;
let engineGain = null;

export function audioAvailable() {
  return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
}

export function initAudio() {
  if (ctx || !audioAvailable()) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function now() { return ctx ? ctx.currentTime : 0; }

function blip(freq, dur, type = 'square', vol = 0.2, slide = 0) {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol = 0.25, lowpass = 1200) {
  if (!ctx) return;
  const t = now();
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() { noiseBurst(0.12, 0.5, 2600); blip(160, 0.08, 'square', 0.25, -90); },
  enemyShoot() { noiseBurst(0.1, 0.2, 1800); },
  pickup() { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 70); },
  cash() { blip(880, 0.07, 'sine', 0.22); setTimeout(() => blip(1174, 0.07, 'sine', 0.22), 60); setTimeout(() => blip(1568, 0.14, 'sine', 0.22), 120); },
  crash() { noiseBurst(0.25, 0.5, 700); },
  sirenBlip() { blip(700, 0.18, 'sine', 0.12, 300); },
  door() { blip(220, 0.08, 'triangle', 0.2, -60); },
  busted() { blip(440, 0.4, 'sawtooth', 0.2, -220); blip(330, 0.5, 'sawtooth', 0.2, -160); },
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 90)); },
  click() { blip(1200, 0.04, 'square', 0.12); },
  phone() { blip(880, 0.12, 'sine', 0.2); setTimeout(() => blip(880, 0.12, 'sine', 0.2), 180); },
};

// Engine hum: one oscillator whose pitch follows speed. Call every frame.
export function engineSound(speed01, on) {
  if (!ctx) return;
  if (!on) {
    if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; engineGain = null; }
    return;
  }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.05;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, now(), 0.05);
  engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.05, now(), 0.05);
}

// Simple two-tone police siren, alternating while wanted >= 2.
let sirenPhase = 0;
export function sirenSound(active, dt) {
  if (!ctx || !active) return;
  sirenPhase += dt;
  if (sirenPhase > 0.42) {
    sirenPhase = 0;
    blip(sirenPhase % 0.84 < 0.42 ? 700 : 950, 0.4, 'sine', 0.06);
  }
}

// Lo-fi bass + hats loop. Chords: Am – F – C – G over a slow 96bpm pulse.
const CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 130.8, 164.8], [98, 123.5, 146.8]];
let musicOn = false;
let beat = 0;
export function startMusic() {
  if (musicOn || !ctx) return;
  musicOn = true;
  const stepMs = 60000 / 96 / 2; // 8th notes at 96bpm
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const chord = CHORDS[Math.floor(beat / 8) % 4];
    const bar = beat % 8;
    if (bar === 0 || bar === 4) blip(chord[0] / 2, 0.5, 'triangle', 0.16);
    if (bar === 2 || bar === 6) blip(chord[1] / 2, 0.4, 'triangle', 0.1);
    if (bar === 7) blip(chord[2], 0.18, 'sine', 0.07);
    if (beat % 2 === 1) noiseBurst(0.03, 0.03, 6000); // hat
    beat++;
  }, stepMs);
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
