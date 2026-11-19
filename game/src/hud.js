// HUD, menus, dialogs and shop screens. Canvas-drawn so screenshots show them.
// Screens: title, pause, shop (garage/gunstore/repair/hospital/safehouse),
// mission briefing, busted/wasted, game complete.

import { WEAPONS, UPGRADES, ECONOMY } from './config.js';
import { clockText, isNight } from './weather.js';
import { drawMinimap } from './render.js';
import { weaponDef } from './player.js';

export function drawHUD(ctx, g, viewW, viewH) {
  const { player, wanted, missions, sky, econ } = g;
  // top-left: wanted stars
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = i < wanted.stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 16 + i * 28, 34);
  }
  // top-left under stars: health + armor bars
  bar(ctx, 16, 44, 180, 12, player.health / 100, '#5fc95f', 'HP');
  bar(ctx, 16, 62, 180, 10, player.armor / 100, '#7ab8e8', 'ARMOR');
  // top-right: money + clock + weather
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText('$' + Math.floor(player.money).toLocaleString(), viewW - 16, 32);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(clockText(sky) + (isNight(sky) ? '  🌙' : sky.rain > 0.3 ? '  🌧' : '  ☀️'), viewW - 16, 56);
  // weapon + ammo bottom-right
  const w = weaponDef(player.weapon);
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#fff';
  const ammo = player.weapon === 'fists' ? '∞' : (player.ammo[player.weapon] || 0);
  ctx.fillText(w.name + '  ·  ' + ammo, viewW - 16, viewH - 18);
  // car health when driving
  if (player.inCar) {
    const c = player.inCar;
    bar(ctx, viewW - 196, viewH - 44, 180, 10, c.hp / c.maxHp, c.hp > 40 ? '#5fc95f' : '#e05f5f', c.def.name);
  }
  // objective line under the stars
  let obj = '';
  if (missions.active) {
    const s = missions.active.mission.steps[missions.active.step];
    obj = '◆ ' + missions.active.mission.title + ' — ' + (s ? s.text : '');
  } else if (missions.sideJob) {
    obj = '◆ Side job — ' + missions.sideJob.text;
  } else if (missions.storyIndex < 8) {
    obj = '◆ Next job: talk to Dex at the garage (press E near it)';
  } else {
    obj = '◆ Story complete! Free roam — try taxi, courier or vigilante jobs.';
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(255,210,63,0.95)';
  ctx.fillText(obj, 16, 92);
  // timed mission countdown
  if (missions.active) {
    const s = missions.active.mission.steps[missions.active.step];
    if (s && s.type === 'timed') {
      const left = Math.max(0, s.seconds - missions.active.timer);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = left < 15 ? '#ff5f5f' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('⏱ ' + Math.ceil(left) + 's', viewW / 2, 44);
    }
  }
  // minimap bottom-left
  drawMinimap(ctx, g, 16, viewH - 176, 160);
  // dialog box
  if (missions.dialog && g.time < missions.dialog.until) {
    dialogBox(ctx, viewW, viewH, missions.dialog.text);
  }
  // controls hint (first minute)
  if (g.time < 45 && !g.hideHints) {
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD move/drive · E enter car · Mouse aim · Click shoot · Shift run · Space handbrake · M mission · Esc pause', viewW / 2, viewH - 8);
  }
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), h - 2);
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 2);
}

function dialogBox(ctx, viewW, viewH, text) {
  const w = Math.min(680, viewW - 60);
  const lines = wrapText(ctx, text, w - 40, '15px sans-serif');
  const h = lines.length * 20 + 28;
  const x = (viewW - w) / 2, y = viewH - h - 190;
  ctx.fillStyle = 'rgba(10,14,22,0.88)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, x + 20, y + 26 + i * 20));
}

export function wrapText(ctx, text, maxW, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawTitle(ctx, viewW, viewH, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, '#1a2a4a');
  grad.addColorStop(0.55, '#c96a3f');
  grad.addColorStop(1, '#2a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  // sun
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(viewW / 2, viewH * 0.42, 60 + 6 * Math.sin(time), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,63,0.25)';
  ctx.beginPath(); ctx.arc(viewW / 2, viewH * 0.42, 92, 0, Math.PI * 2); ctx.fill();
  // skyline silhouette
  ctx.fillStyle = '#14101e';
  const base = viewH * 0.62;
  for (let i = 0; i < 24; i++) {
    const bw = viewW / 24;
    const bh = 40 + ((i * 37) % 130);
    ctx.fillRect(i * bw, base - bh, bw - 3, bh + viewH);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLARA BAY', viewW / 2, viewH * 0.3);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('A STORY OF SUN, SPEED AND SECOND CHANCES', viewW / 2, viewH * 0.3 + 34);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '17px sans-serif';
  ctx.fillText('Mara Quinn is back in the city that made her — and the city wants her gone.', viewW / 2, viewH * 0.72);
  ctx.fillText('8 story missions · side jobs · car upgrades · a living city, day and night', viewW / 2, viewH * 0.72 + 26);
  const blink = Math.floor(time * 1.6) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('— PRESS ENTER TO PLAY —', viewW / 2, viewH * 0.84);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim · Click shoot · Shift run · Space handbrake · Esc pause', viewW / 2, viewH * 0.9);
  ctx.fillText('An original game. No Rockstar content. Built for make.fun gta6-01.', viewW / 2, viewH * 0.94);
}

export function drawPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 40);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Esc resume · R restart · S save game · L load game', viewW / 2, viewH / 2 + 10);
  ctx.fillText('Enter a car (E) near any parked car. Steal in front of a cop and they will chase you.', viewW / 2, viewH / 2 + 44);
}

export function drawEnd(ctx, viewW, viewH, kind, stats) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,80,0.85)' : 'rgba(80,10,10,0.85)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2 - 30);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(kind === 'busted'
    ? 'The Solara Bay PD caught up with you. Bail posted — you keep your cars, lose some cash.'
    : 'Mara is down. The hospital patches her up — for a fee.', viewW / 2, viewH / 2 + 8);
  ctx.fillText(`Missions done: ${stats.missions} · Cash: $${Math.floor(stats.money)}`, viewW / 2, viewH / 2 + 40);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('— PRESS ENTER TO CONTINUE —', viewW / 2, viewH / 2 + 84);
}

export function drawComplete(ctx, viewW, viewH, stats) {
  ctx.fillStyle = 'rgba(10,30,20,0.88)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('SUNSET SCORE', viewW / 2, viewH / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mara pulled off the last job. Solara Bay is hers now — and the sun is setting on the bay.', viewW / 2, viewH / 2 - 10);
  ctx.fillText(`Final cash: $${Math.floor(stats.money)} · Missions: ${stats.missions}/8 · Play time: ${Math.floor(stats.time / 60)} min`, viewW / 2, viewH / 2 + 26);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('— PRESS ENTER TO KEEP PLAYING —', viewW / 2, viewH / 2 + 72);
}

// Shop menu: returns the list of purchasable rows for the shop kind.
export function shopRows(shop, player, econ) {
  if (shop.kind === 'garage') {
    return UPGRADES.map((u) => ({
      label: `${u.name} — ${u.desc}`, price: u.price,
      owned: econ.ownedUpgrades.includes(u.id), action: () => u.id,
    }));
  }
  if (shop.kind === 'gunstore') {
    const rows = WEAPONS.filter((w) => w.id !== 'fists').map((w) => ({
      label: `${w.name} — dmg ${w.dmg} · ${w.auto ? 'auto' : 'semi'}`, price: w.price,
      owned: econ.ownedWeapons.includes(w.id), action: () => w.id,
    }));
    rows.push({ label: 'Ammo refill (all owned weapons)', price: 40, owned: false, action: () => 'ammo' });
    return rows;
  }
  if (shop.kind === 'repair') return [{ label: 'Full repair + wash', price: ECONOMY.repairCost, owned: false, action: () => 'repair' }];
  if (shop.kind === 'hospital') return [{ label: 'Full treatment (health + armor)', price: ECONOMY.hospitalCost, owned: false, action: () => 'heal' }];
  if (shop.kind === 'safehouse') return [{ label: 'Rest + save game (heals 25)', price: 0, owned: false, action: () => 'rest' }];
  return [];
}

export function drawShop(ctx, viewW, viewH, shop, rows, sel) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  const w = 520, h = 120 + rows.length * 42;
  const x = (viewW - w) / 2, y = (viewH - h) / 2;
  ctx.fillStyle = 'rgba(12,18,28,0.95)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(shop.name, x + 24, y + 38);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#fff';
  rows.forEach((r, i) => {
    const ry = y + 66 + i * 42;
    if (i === sel) {
      ctx.fillStyle = 'rgba(255,210,63,0.2)';
      ctx.fillRect(x + 12, ry - 20, w - 24, 34);
    }
    ctx.fillStyle = r.owned ? '#7ee787' : '#fff';
    ctx.fillText((i === sel ? '▸ ' : '   ') + r.label, x + 24, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = r.owned ? '#7ee787' : '#7ee787';
    ctx.fillText(r.owned ? 'OWNED' : '$' + r.price, x + w - 24, ry);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText('↑↓ choose · Enter buy · E/Esc close', x + 24, y + h - 18);
}
