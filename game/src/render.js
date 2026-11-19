// Renderer: camera, city, entities, particles, lighting and the minimap.
// All drawing lives here; game logic never touches the canvas.

import { WORLD } from './config.js';
import { clamp, lerp } from './rng.js';
import { skyTint, isNight, isGoldenHour, daylight } from './weather.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 0.8, shake: 0 };
}

export function updateCamera(cam, focusX, focusY, dt, viewW, viewH) {
  const tx = focusX - viewW / 2 / cam.zoom;
  const ty = focusY - viewH / 2 / cam.zoom;
  cam.x = lerp(cam.x, tx, Math.min(1, 6 * dt));
  cam.y = lerp(cam.y, ty, Math.min(1, 6 * dt));
  cam.shake = Math.max(0, cam.shake - dt * 2.2);
}

function shakeOffset(cam) {
  if (cam.shake <= 0) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * cam.shake * 14, y: (Math.random() - 0.5) * cam.shake * 14 };
}

export function drawWorld(ctx, g, cam, viewW, viewH) {
  const { city, sky, player, cars, peds, wanted, bullets, particles, enemies, missions, econ } = g;
  const sh = shakeOffset(cam);
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x - viewW / 2 / cam.zoom + sh.x, -cam.y - viewH / 2 / cam.zoom + sh.y);

  const half = WORLD.size / 2;
  const vx0 = cam.x - 60, vy0 = cam.y - 60;
  const vx1 = cam.x + viewW / cam.zoom + 60, vy1 = cam.y + viewH / cam.zoom + 60;

  // ground: grass base, then sand on the west edge (beach) and water beyond it
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(-half - 260, vy0, 260, vy1 - vy0); // beach strip
  ctx.fillStyle = '#3f8fd0';
  ctx.fillRect(-half - 900, vy0, 640, vy1 - vy0); // the bay
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 5; i++) {
    const wy = vy0 + ((i * 173 + 40) % Math.max(1, vy1 - vy0));
    ctx.fillRect(-half - 880, wy, 620, 3);
  }

  // city blocks: pavement, then parks/beach tinted by district
  for (const b of city.blocks) {
    if (b.x < vx0 - 260 || b.x > vx1 + 260 || b.y < vy0 - 260 || b.y > vy1 + 260) continue;
    const bx = b.x - 113, by = b.y - 113;
    if (b.kind === 'park') ctx.fillStyle = '#4f8f4a';
    else if (b.kind === 'beach') ctx.fillStyle = '#e8d28a';
    else ctx.fillStyle = '#8d8d84';
    ctx.fillRect(bx, by, 226, 226);
    if (b.kind === 'park') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(bx + 20, by + 20, 186, 8);
      ctx.fillRect(bx + 20, by + 100, 186, 8);
    }
  }

  // roads: dark asphalt with centre dashes
  ctx.fillStyle = '#3a3d42';
  const roadStep = WORLD.block;
  for (let i = 0; i <= 10; i++) {
    const c = -half + i * roadStep;
    ctx.fillRect(c - 13, -half, 26, WORLD.size);
    ctx.fillRect(-half, c - 13, WORLD.size, 26);
  }
  ctx.strokeStyle = 'rgba(240,220,120,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const c = -half + i * roadStep;
    ctx.moveTo(c, -half); ctx.lineTo(c, half);
    ctx.moveTo(-half, c); ctx.lineTo(half, c);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // trees
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = t.shade;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 4, t.y - 8); ctx.stroke();
    }
  }

  // buildings with height shading + windows
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    const shade = 0.82 + Math.min(0.18, b.hgt / 200);
    ctx.fillStyle = shadeColor(b.color, shade);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // rooftop detail for landmarks
    if (b.kind === 'landmark') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
    } else if (b.kind !== 'pond') {
      // windows
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 22)), rows = Math.max(1, Math.floor(b.h / 22));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.x) % 3 === 0) continue;
        ctx.fillRect(b.x + 7 + i * 22, b.y + 7 + j * 22, 9, 12);
      }
    }
    if (b.kind === 'pond') {
      ctx.fillStyle = '#4f8fd0';
      ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // shops: marked plots with signs
  for (const s of econ.shops) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 34, s.y - 24, 68, 48);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 34, s.y - 24, 68, 48);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.name.split(' ')[0].toUpperCase(), s.x, s.y + 4);
  }

  // mission markers: pulsing beacon at the current objective
  const step = missions.active ? missions.active.mission.steps[missions.active.step] : null;
  const side = missions.sideJob;
  const marker = step && step.x !== undefined ? { x: step.x, y: step.y, color: '#ffd23f' }
    : side ? { x: side.x, y: side.y, color: '#7ad0ff' } : null;
  if (marker) {
    const pulse = 1 + 0.25 * Math.sin(g.time * 5);
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = marker.color;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2); ctx.fill();
    // guide line from player to marker
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    ctx.strokeStyle = 'rgba(255,210,63,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(marker.x, marker.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // skid marks + particles under entities
  for (const pt of particles) {
    if (pt.kind === 'skid') {
      ctx.strokeStyle = 'rgba(20,20,20,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x + pt.vx, pt.y + pt.vy); ctx.stroke();
    }
  }

  drawCarList(ctx, cars, g.time);
  drawCarList(ctx, wanted.cops.filter((c) => c.kind === 'car').map((c) => c.car), g.time, true);
  for (const e of enemies) drawPerson(ctx, e.x, e.y, e.angle, '#c94f4f', true);
  for (const p of peds) {
    if (p.dead) {
      ctx.fillStyle = 'rgba(120,0,0,0.7)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    drawPerson(ctx, p.x, p.y, p.angle, p.shirt, false);
  }
  for (const c of wanted.cops) {
    if (c.kind === 'foot') drawPerson(ctx, c.x, c.y, c.angle, '#20242c', true, true);
  }
  if (wanted.heli) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(wanted.heli.x + 14, wanted.heli.y + 18, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c3440';
    ctx.beginPath(); ctx.ellipse(wanted.heli.x, wanted.heli.y, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(wanted.heli.x - 8, wanted.heli.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // bullets
  ctx.fillStyle = '#ffe9a0';
  for (const b of bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
  // particles: smoke, sparks, blood, muzzle
  for (const pt of particles) {
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${pt.life * 0.4})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,200,80,${pt.life})`;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = `rgba(160,20,20,${pt.life})`;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    } else if (pt.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,240,160,${pt.life})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 7 * pt.life + 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // player car or player on foot
  if (player.inCar) drawCar(ctx, player.inCar, g.time, true);
  else drawPerson(ctx, player.x, player.y, player.angle, '#2f6fb8', true, false, true);

  // night: lamp glow + headlight cones
  if (isNight(sky)) {
    ctx.fillStyle = 'rgba(255,220,140,0.10)';
    for (const l of city.lamps) {
      if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
      ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.fill();
    }
    if (player.inCar) {
      const c = player.inCar;
      const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
      const grad = ctx.createRadialGradient(c.x + fx * 60, c.y + fy * 60, 10, c.x + fx * 60, c.y + fy * 60, 150);
      grad.addColorStop(0, 'rgba(255,240,180,0.20)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(c.x + fx * 60, c.y + fy * 60, 150, 0, Math.PI * 2); ctx.fill();
    }
  }
  // rain streaks
  if (sky.rain > 0.15) {
    ctx.strokeStyle = `rgba(180,200,230,${0.35 * sky.rain})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const rx = vx0 + ((i * 97 + g.time * 300) % (vx1 - vx0));
      const ry = vy0 + ((i * 173 + g.time * 700) % (vy1 - vy0));
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 22);
    }
    ctx.stroke();
  }

  ctx.restore();

  // full-screen sky wash (day/night/golden hour)
  const tint = skyTint(sky);
  if (tint.alpha > 0.01) {
    ctx.fillStyle = `rgba(${tint.wash[0]},${tint.wash[1]},${tint.wash[2]},${tint.alpha})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawCarList(ctx, cars, time, isCop = false) {
  for (const c of cars) drawCar(ctx, c, time, false, isCop);
}

function drawCar(ctx, car, time, isPlayer, isCop = false) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.model === 'van' || car.model === 'truck' ? 46 : 40;
  const h = 20;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  // cabin + windshield
  ctx.fillStyle = 'rgba(30,40,55,0.85)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 9, -h / 2 + 3, w * 0.42, h - 6, 4);
  ctx.fill();
  // headlights
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 4);
  ctx.fillRect(w / 2 - 3, h / 2 - 6, 3, 4);
  // taillights
  ctx.fillStyle = '#c92f2f';
  ctx.fillRect(-w / 2, -h / 2 + 2, 3, 4);
  ctx.fillRect(-w / 2, h / 2 - 6, 3, 4);
  if (isCop || car.model === 'police') {
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2f2f' : '#2f6fff';
    ctx.fillRect(-6, -h / 2 - 3, 12, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 8);
    ctx.stroke();
  }
  // damage smoke
  if (car.smoke > 0.3) {
    ctx.fillStyle = `rgba(100,100,100,${car.smoke * 0.6})`;
    ctx.beginPath(); ctx.arc(-w / 2, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // health bar for damaged player car
  if (isPlayer && car.hp < car.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(car.x - 24, car.y - 26, 48, 6);
    ctx.fillStyle = car.hp > 40 ? '#5fc95f' : '#e05f5f';
    ctx.fillRect(car.x - 23, car.y - 25, 46 * (car.hp / car.maxHp), 4);
  }
}

function drawPerson(ctx, x, y, angle, shirt, armed, isCop = false, isPlayer = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(4, 0, 5, 0, Math.PI * 2); ctx.fill();
  // gun
  if (armed) {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -1.5, 10, 3);
  }
  if (isCop) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, -10);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function shadeColor(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// ---- Minimap ----
export function drawMinimap(ctx, g, x, y, size) {
  const { city, player, wanted, missions } = g;
  const half = WORLD.size / 2;
  const scale = size / WORLD.size;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  ctx.beginPath(); ctx.roundRect(0, 0, size, size, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, size, size, 8); ctx.clip();
  // water + beach
  ctx.fillStyle = '#3f8fd0';
  ctx.fillRect(0, 0, 12 * scale * 10, size);
  // roads
  ctx.strokeStyle = 'rgba(220,220,220,0.65)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const c = (i * WORLD.block) * scale;
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(size, c); ctx.stroke();
  }
  // buildings
  ctx.fillStyle = 'rgba(200,210,220,0.5)';
  for (const b of city.buildings) {
    ctx.fillRect((b.x + half) * scale, (b.y + half) * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  // mission marker
  const step = missions.active ? missions.active.mission.steps[missions.active.step] : null;
  if (step && step.x !== undefined) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc((step.x + half) * scale, (step.y + half) * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  // cops
  ctx.fillStyle = '#5f8fff';
  for (const c of wanted.cops) {
    const cx = c.kind === 'car' ? c.car.x : c.x;
    const cy = c.kind === 'car' ? c.car.y : c.y;
    ctx.fillRect((cx + half) * scale - 2, (cy + half) * scale - 2, 4, 4);
  }
  // player arrow
  const px = (player.inCar ? player.inCar.x : player.x) + half;
  const py = (player.inCar ? player.inCar.y : player.y) + half;
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(px * scale, py * scale);
  ctx.rotate(player.angle);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}
