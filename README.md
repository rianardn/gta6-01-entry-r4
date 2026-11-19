# Solara Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rianardn/gta6-01-entry-r4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rianardn/gta6-01-entry-r4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game, built for the **gta6-01** bounty ("Make GTA 6").
You are **Mara Quinn**, an ex-getaway driver pulled back into Solara Bay — a
sun-soaked coastal city of sixteen districts, from the Marina to The Strip.

## Play

Serve the game and open it in a desktop browser (no network needed):

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| E | Enter or exit a car · talk to Dex · open a shop |
| Mouse + click | Aim and shoot |
| Q | Switch weapon |
| Shift | Run |
| Space | Handbrake / drift |
| 1 / 2 / 3 | Taxi / courier / vigilante side job |
| Esc | Pause (S save, L load, R restart) |

## What is in the game

- **A living city**: 100 blocks across 16 districts, traffic that follows the
  roads, pedestrians on the sidewalks, a beach and a bay to the west, parks,
  a stadium, a marina, docks and The Strip.
- **8 story missions**: from a first pickup at the Marina to the Sunset Score
  at the Grand Solara Hotel — with chases, shootouts, a timed airport run and
  a 3-star escape.
- **Side jobs**: taxi fares, courier deliveries and vigilante work, all
  repeatable for cash.
- **Wanted system**: 0–5 stars. Steal a car in front of a cop, shoot, or run
  someone over and the Solara Bay PD responds — patrol cars, interceptors at
  4 stars, a helicopter at 5. Lie low and the heat decays.
- **Economy**: earn cash, buy engine and armor upgrades at Dex's Garage,
  weapons at Ironworks Guns, repairs at Quick Fix Auto, treatment at Solara
  General, and rest + save at the Southside Safehouse.
- **Day and night**: a full clock with golden-hour sunsets, night lamp glow
  and headlights, and rain that makes the roads slippery.
- **Sound**: synthesised WebAudio engine hum, sirens, gunshots and a lo-fi
  bass loop — no audio files.
- **Save/load**: progress saves to localStorage.

## Structure

- `game/index.html` — the page, a full-screen canvas
- `game/src/config.js` — tuning, districts, cars, weapons, upgrades
- `game/src/city.js` — city generation (pure, tested)
- `game/src/rng.js` — seeded RNG and math helpers
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesised sound and music
- `game/src/player.js` — on-foot movement, health, weapons
- `game/src/vehicles.js` — arcade car physics, carjacking
- `game/src/traffic.js` — traffic and pedestrian AI
- `game/src/police.js` — wanted levels and cop AI
- `game/src/missions.js` — story missions and side jobs
- `game/src/economy.js` — shops, upgrades, money
- `game/src/weather.js` — day/night cycle and rain
- `game/src/render.js` — camera, world, lighting, minimap
- `game/src/hud.js` — HUD, menus, dialogs, shops
- `game/src/shots.js` — screenshot scenes and autopilot
- `game/src/main.js` — game loop, combat, save/load
- `test.js` — Node self-test (`node test.js`)

An original game: its own city, characters, vehicles, names, story, art,
sounds and music. No Rockstar Games content.
