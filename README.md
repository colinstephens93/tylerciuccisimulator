# Tyler Ciucci Simulator

A small, mobile-friendly pixel-art browser game about Deputy Tyler Ciucci, a School Resource Officer in Lawrenceville, Georgia: walk to the patrol car, drive to Wawa, get breakfast and a Ghost Energy, and make it to school before the 8:00 AM bell. A fan game made for friends.

**Status:** Playable skeleton with placeholder art and maps.

## Play locally

```bash
npm install
npm run dev      # open the printed URL on your phone (same Wi-Fi) or desktop
npm test         # game-logic tests
npm run build    # production build in dist/
```

Controls: tap the map to walk; hold `<` / `BRAKE` / `>` to drive; `LIGHTS` for the siren. Desktop: arrow keys / WASD, Space to brake, L for lights.

## Changing names and tuning

| File | What it controls |
| --- | --- |
| `src/config/game.config.json` | School name and mascot, start time, first bell, clock speed, Wawa goals, caffeine per can, patrol car colors |
| `src/data/menu.json` | Wawa food items (calories) and Ghost flavors |
| `src/data/amanda-calls.json` | Amanda's call lines, replies, missed-call texts, closing texts |

## Code map

| Path | Purpose |
| --- | --- |
| `src/flow.js` | Scene order for "The Morning Run" and transitions |
| `src/state.js` | Run state, checkpoints for "Retry this scene", saved settings |
| `src/logic/` | Pure rules (clock, Wawa goals, scoring, Amanda's mood), unit tested in `tests/` |
| `src/scenes/` | Title, Walk (map), Drive, Wawa interior, Phone (Amanda), HUD, Results |
| `src/audio.js` | Synthesized chiptune music and sound effects (Web Audio) |
| `src/gfx/textures.js` | Placeholder pixel sprites generated in code |

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/requirements.md](docs/requirements.md) | Game vision, scope, MVP gameplay, and technical requirements |
| [docs/open-questions.md](docs/open-questions.md) | Decisions still needed |
| [docs/decisions.md](docs/decisions.md) | Log of decisions already made, and why |
| [docs/roadmap.md](docs/roadmap.md) | What is built and what is next |
