// Day/night cycle + weather for Solara Bay.
// Time advances in game hours; the sky tint, sun position and lamp glow follow it.
// Weather: clear, golden hour, rain (slippery roads + streaks), night.

import { DAY } from './config.js';
import { clamp, lerp } from './rng.js';

export function createSky() {
  return {
    hour: DAY.startHour, // 0-24
    weather: 'clear', // 'clear' | 'rain'
    weatherTimer: 90,
    rain: 0, // 0..1 intensity
  };
}

export function updateSky(sky, dt) {
  sky.hour = (sky.hour + (dt / DAY.lengthSec) * 24) % 24;
  sky.weatherTimer -= dt;
  if (sky.weatherTimer <= 0) {
    sky.weatherTimer = 60 + Math.random() * 120;
    sky.weather = sky.weather === 'clear' && Math.random() < 0.35 ? 'rain' : 'clear';
  }
  const target = sky.weather === 'rain' ? 1 : 0;
  sky.rain = clamp(sky.rain + Math.sign(target - sky.rain) * dt * 0.4, 0, 1);
}

// 0 = pitch dark, 1 = full daylight. Golden hour ~16.5-18.5.
export function daylight(sky) {
  const h = sky.hour;
  if (h >= 6 && h < 8) return lerp(0.15, 0.9, (h - 6) / 2);
  if (h >= 8 && h < 16.5) return 1;
  if (h >= 16.5 && h < 18.5) return lerp(1, 0.25, (h - 16.5) / 2); // sunset
  if (h >= 18.5 && h < 20) return lerp(0.25, 0.12, (h - 18.5) / 1.5);
  if (h >= 20 || h < 5) return 0.12;
  return lerp(0.12, 0.15, (h - 5) / 1); // 5-6 dawn
}

export function isGoldenHour(sky) {
  return sky.hour >= 16.5 && sky.hour < 18.5;
}

export function isNight(sky) {
  return sky.hour >= 19.5 || sky.hour < 5.5;
}

// Sky tint used by the renderer: [r,g,b] wash over the scene + ambient light.
export function skyTint(sky) {
  const dl = daylight(sky);
  if (isGoldenHour(sky)) {
    const t = (sky.hour - 16.5) / 2;
    return { wash: [255, 150 + 60 * (1 - t), 60], alpha: 0.16 + 0.1 * t, light: dl };
  }
  if (isNight(sky)) return { wash: [20, 30, 70], alpha: 0.34, light: dl };
  if (sky.weather === 'rain') return { wash: [90, 100, 120], alpha: 0.18, light: dl * 0.75 };
  return { wash: [255, 255, 255], alpha: 0, light: dl };
}

export function clockText(sky) {
  const h = Math.floor(sky.hour);
  const m = Math.floor((sky.hour - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function gripFactor(sky) {
  return sky.rain > 0.3 ? 0.75 : 1; // wet roads are slippery
}
