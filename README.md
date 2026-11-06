# Tyler Ciucci Simulator

A lightweight free-roam sandbox game set on the real streets of Lawrenceville, Georgia. Play as Deputy Tyler Ciucci: run around or drive anywhere, jump into any car, cause a little cartoon chaos, hunt for hidden Ghost Energy cans, and take on short timed missions. Inspired by the feel of early-2000s open-city games. A fan game made for friends.

Runs entirely in the browser (static HTML/CSS/JS, no backend). Built for iPhone first; also works on desktop.

## Play locally

```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi) or desktop
npm test         # unit tests (collisions, road network, missions, heat)
npm run build    # production build in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Controls

| | Touch | Keyboard |
| --- | --- | --- |
| Move / steer + gas | Left thumb joystick (appears where you touch) | WASD or arrow keys |
| Look around | Drag the open screen; pinch to zoom | Mouse drag; wheel zooms |
| Jump / drift | JUMP / DRIFT | Space |
| Kick | KICK | F |
| Get in / out of a car | GET IN / TAKE CAR / EXIT | E |
| Horn | HORN | H |
| Siren (patrol car) | SIREN | L |

## What's in town

- **Free roam:** the whole OpenStreetMap street grid, with building and tree collisions. Drive off-road if you like (it's slower).
- **Any car:** your patrol car is parked at home. Walk up to traffic and tap TAKE CAR for some "official business".
- **Living streets:** AI traffic follows real lanes and one-ways, stops for you, and pulls over for the siren. Pedestrians stroll the sidewalks and dive out of the way.
- **Light chaos:** hydrants, mailboxes, trash cans, cones and news boxes go flying and spill coins. Pedestrians bounce (cartoon style) and get back up.
- **Heat and Sarge:** chaos fills the HEAT meter. Fill it and Sarge comes after you; get rammed and you're BUSTED (a coin fine). Get far away and lay low to escape.
- **Missions:** yellow `!` markers. Timed deliveries, collection runs, a smash spree, and a pursuit. Best times are saved.
- **Hidden Ghost cans:** 20 green cans with light beams spread around town. Each one gives coins and a speed boost.

Progress (coins, cans, mission records) and sound settings are saved in the browser's localStorage.

## Changing things

| File | What it controls |
| --- | --- |
| `src/config/game.config.json` | Names, patrol car colors, walk/run/jump speeds, traffic and pedestrian counts, number of hidden cans, max pixel ratio |
| `src/data/missions.json` | Missions: who sends them, brief text, stages (`reach`, `meet`, `collect`, `smash`, `pursuit`; a `meet` stage has dialogue lines), time limits, rewards. Checked by `npm test` |
| `src/data/dan.json` | Lines Dan says when you walk up to him in free roam |
| `src/config/places.json` | Where the house, Wawa, school, El Cregs and the square sit on the map |

## Code map

| Path | Purpose |
| --- | --- |
| `src/game.js` | Main loop: player on foot or driving, collisions between everything, missions, heat and Sarge, HUD data |
| `src/engine/` | `world.js` (renderer, chase camera, shake, labels), `input.js` (joystick, buttons, keyboard), `models.js` (cartoon characters, shared animation rig, cars, props, landmarks), `tyler.js` (detailed Tyler model from the reference photo), `elcregs.js` (El Cregs food truck and Agent Dan), `fx.js` (particles) |
| `src/player/onFoot.js` | Tyler's on-foot controller (camera-relative movement, jump, kick) |
| `src/sim/` | `vehicle.js` (arcade car physics, drift, bounces), `traffic.js`, `peds.js`, `props.js`, `pickups.js` (coins, Ghost cans), `colliders.js` (spatial collision grid), `roadnet.js` (lanes for AI) |
| `src/missions/` | `logic.js` (pure mission rules, tested), `runner.js` (beacons, spawned targets) |
| `src/logic/heat.js` | Heat meter rules (tested) |
| `src/map/` | `cityMesh.js` (3D town from OSM), `graph.js` (routing), `places.js` (landmarks, GPS) |
| `src/ui/` | HUD, mini-map, title / brief / pause screens |
| `src/audio.js` | Synthesized chiptune music, sound effects and engine hum (no audio files) |
| `scripts/fetch-osm.mjs` | Downloads OpenStreetMap data and writes `src/data/lawrenceville.json` |

Everything is drawn from code: no model, texture or audio files. First load is about 300 KB gzipped.

Map data (c) OpenStreetMap contributors, available under the Open Database License.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/requirements.md](docs/requirements.md) | Vision, gameplay, style and technical requirements |
| [docs/decisions.md](docs/decisions.md) | Log of decisions and why |
| [docs/roadmap.md](docs/roadmap.md) | What is built and what is next |
| [docs/open-questions.md](docs/open-questions.md) | Decisions still needed |
