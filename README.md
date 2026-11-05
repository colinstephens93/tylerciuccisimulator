# Tyler Ciucci Simulator

A small, mobile-friendly 3D browser game about Deputy Tyler Ciucci, a School Resource Officer in Lawrenceville, Georgia: walk to the patrol car, drive to Wawa, get breakfast and a Ghost Energy, and make it to school before the 8:00 AM bell. A fan game made for friends.

**Status:** Playable 3D version on real Lawrenceville streets (OpenStreetMap). Simple low-poly art.

## Play locally

```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi) or desktop
npm test         # game-logic tests
npm run build    # production build in dist/
```

Controls: tap the map to walk, drag to rotate the camera, pinch to zoom. Driving: tap the arrows to change lanes, hold BRAKE, tap LIGHTS for the siren. Desktop: arrow keys / WASD, S or Space to brake, L for lights, mouse wheel to zoom.

Rebuild the map data (optional): `node scripts/fetch-osm.mjs`

## Changing names and tuning

| File | What it controls |
| --- | --- |
| `src/config/game.config.json` | School name and mascot, start time, first bell, clock speed, Wawa goals, caffeine per can, patrol car colors |
| `src/data/menu.json` | Wawa food items (calories) and Ghost flavors |
| `src/data/amanda-calls.json` | Amanda's call lines, replies, missed-call texts, closing texts |
| `src/config/places.json` | Where the house, Wawa and school sit on the real map |

## Code map

| Path | Purpose |
| --- | --- |
| `src/game.js` | Owns the 3D world, models, UI and the current mode |
| `src/flow.js` | Step order for "The Morning Run" and transitions |
| `src/modes/` | `walk.js` (on foot), `drive.js` (patrol car on real routes), `wawa.js` (store interior) |
| `src/engine/` | `world.js` (renderer, camera, touch input, labels), `models.js` (Tyler, cars, buildings) |
| `src/map/` | `cityMesh.js` (3D town from OSM), `graph.js` (routing), `places.js` |
| `src/ui/` | HUD, phone calls, panels, title/results screens |
| `src/state.js` | Run state, checkpoints for "Retry", saved settings |
| `src/logic/` | Pure rules (clock, Wawa goals, scoring, Amanda's mood), unit tested |
| `src/audio.js` | Synthesized chiptune music and sound effects |
| `scripts/fetch-osm.mjs` | Downloads OpenStreetMap data and writes `src/data/lawrenceville.json` |

Map data (c) OpenStreetMap contributors, available under the Open Database License.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/requirements.md](docs/requirements.md) | Game vision, scope, MVP gameplay, and technical requirements |
| [docs/open-questions.md](docs/open-questions.md) | Decisions still needed |
| [docs/decisions.md](docs/decisions.md) | Log of decisions already made, and why |
| [docs/roadmap.md](docs/roadmap.md) | What is built and what is next |
