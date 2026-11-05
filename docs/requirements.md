# Requirements

Version 0.7 - 2026-11-05

## 1. Vision

A short, lighthearted, mobile-friendly 3D web game that follows Deputy Tyler Ciucci, a School Resource Officer (SRO) in Lawrenceville, Georgia (Gwinnett County, just northeast of Atlanta), through the start of his workday. The tone is affectionate comedy.

Target session length: 3 to 5 minutes for the MVP.

## 2. Platform and audience

- Runs in a mobile web browser (iOS Safari, Android Chrome) with no install.
- Also playable on desktop browsers (keyboard and mouse).
- Primary orientation: portrait.
- Audience: friends, family, and coworkers of Tyler.

## 3. Visual direction and controls

The game is a 3D, location-based map game in the style of Pokemon Go, set on Lawrenceville's real streets. It is an original game in that genre: we use the genre's conventions, not Pokemon Go's own art, UI, icons, sounds, or characters.

- **Look:** Smooth 3D with cartoon (toon) shading. Low-poly buildings extruded from real OpenStreetMap footprints, roads at their real positions, pine and hardwood trees, soft sky and distance fog.
- **Camera:** Tilted 3D camera that follows Tyler. Drag to rotate around him, pinch (or mouse wheel) to zoom.
- **On foot:** Tyler stays centered with a pulsing ring under him. Tap the ground to walk there; tap a destination (beacon, label, or building) to walk to it. Destinations have a floating pin beacon and a label.
- **Driving:** The same 3D world. Tyler gets in the patrol car and drives the real route, shown as a GPS-style line. The camera sits behind the car (drag to look around; it drifts back).
- **Movement is virtual** (tap/drag), not real GPS, so friends anywhere can play.
- **Interiors:** Walking through the Wawa door enters a 3D store interior with a cutaway front wall.
- **UI:** Native web UI over the 3D view (clock card, objective pill, toasts, panels, phone call card) so text stays crisp on phones.

## 4. Character: Tyler Ciucci

3D model reference is a photo the user supplied (kept out of the repo).

| Trait | Description |
| --- | --- |
| Build | Tall, broad, stocky |
| Hair | Short dark brown, neat |
| Face | Full short beard, mustache, serious "on duty" expression |
| Uniform | Black long-sleeve uniform polo, black pants, black belt |
| Badge | Silver six-point star on left chest |
| Gear | Duty belt with flashlight holster; gold badge clipped at the belt |
| Details | Black wristband; phone with a red phone grip (good for idle/selfie animation) |

Model (MVP): low-poly cartoon figure built in code, oversized on the map so he reads well, with a walk cycle (arm/leg swing, bob). Later: idle phone-check animation and a "drinking Ghost" reaction.

No real agency patches or insignia text; a generic silver star.

## 5. Setting: Lawrenceville, Georgia

- **Real streets:** The town follows Lawrenceville's real street layout and building footprints from OpenStreetMap (OSM).
  - `scripts/fetch-osm.mjs` downloads OSM data once and writes a compact file (`src/data/lawrenceville.json`, about 380 KB). The game does not load live map tiles, so it works offline.
  - Drives use real routing over the street graph, including one-way streets.
  - Major real roads and landmarks are recognizable (for example, the historic downtown square and courthouse, US-29 / Pike St, GA-20 / Buford Dr, GA-316).
  - OSM's license (ODbL) requires credit: the game shows "Map data (c) OpenStreetMap contributors" on the title or credits screen.
- **Tyler's home:** A generic house on Honeysuckle Avenue, chosen at random. Not his real address.
- **Places config:** `src/config/places.json` sets where the house, Wawa, and school go (lot center and road). Real buildings on those lots are removed.
- **Wawa:** Made up, on West Pike Street. No real Wawa exists there; this is creative license.
- **School:** Fictional and renameable (see section 9), on New Hope Road.
- **Georgia flavor:** Pine trees, red clay, a peach stand, humid haze in the morning light.

## 6. MVP gameplay: "The Morning Run"

The game alternates between walking mode and driving mode.

### Scene 1 - Leaving home (walking)
- Tyler starts outside his house on the town map. Short tutorial: tap to walk to the vehicle.
- Clock starts at 7:00 AM (configurable).

### Scene 2 - Drive to Wawa (driving)
- The patrol car follows the real route along Lawrenceville streets (currently Honeysuckle Avenue to West Pike Street), shown as a GPS-style line.
- Controls: the car accelerates on its own. Tap left/right to change lanes, hold BRAKE to slow down. Desktop: arrow keys / A-D, S or Space to brake.
- Hazards: traffic in your direction (cars, pickups, school buses), potholes; oncoming traffic for atmosphere.
- Collisions cost time; they never end the game.
- End: pull into the Wawa lot.

### Patrol car

- 3D marked patrol car: dark body with white doors, "SHERIFF" lettering, roof light bar, push bumper.
- Generic markings only: no real agency seal, unit number, or plate. Livery colors and door text are set in the config file.
- **Lights button (proposed):** Tapping it turns on the light bar and siren, and traffic pulls aside. Using it for a breakfast run is not an emergency, so each use adds an infraction (and possibly an Amanda-style text from "Sarge"). Risk/reward for players who are running late.
- Light bar flashes on the parked car outside Wawa and the school as an idle detail.

### Scene 3 - Wawa (walking, then interior)
- Walk across the parking lot on the map and into the front door.
- Interior is a 3D Wawa-style store: entrance, touchscreen ordering kiosks, deli counter with staff, Ghost cooler, snack aisles, coffee bar, register.
- **Wawa goals** (must be checked before leaving the store):
  - **Food:** at least **1,000 calories** of food.
  - **Caffeine:** at least **300 mg** of caffeine.
- **Food menu:** Any breakfast sandwich or breakfast item counts. Every food item on the menu is at least **500 calories**, so two items meet the food goal. Examples: breakfast sandwiches, a breakfast burrito, a breakfast bowl, a breakfast hoagie. Extras (extra meat, extra cheese) add calories.
- **Drinks:** Each Ghost Energy can has **300 mg** of caffeine (game value; set in config), so one can meets the caffeine goal. Drink calories do not count toward the food goal.
- **Flow:** Order food at the kiosk and pick it up at the counter when the number is called; grab Ghost Energy from the cooler; pay at the register.
- **Leaving the store:** A tray/bag HUD shows running totals (for example, "Food 560 / 1,000 cal", "Caffeine 300 / 300 mg"). If a goal is not met when Tyler walks to the door, a prompt asks "Leave anyway?".
- **Scoring:**
  - Food under 1,000 calories: lower score (not a fail).
  - Caffeine under 300 mg: lower score (not a fail).
  - Over the caffeine goal: no penalty.
  - Over the calorie goal: no penalty.
- Calorie and caffeine values for each item live in `src/data/menu.json`. Values are game values, not official nutrition facts.
- Light flavor: other customers in line, a "your order is ready" call-out.
- Exit back to the vehicle.

### Scene 4 - Drive to school (driving)
- Same driving engine, real route through downtown (West Pike, Crogan, Culver, Luckie, Jackson, New Hope Road).
- School-zone hazards: reduced speed limit, crossing guard, buses, car-rider line.
- Speeding in the school zone adds an infraction (score penalty, not a fail).

### Scene 5 - Arrive at school (walking)
- Park, walk to the front entrance. Reaching the door stops the clock.

### Running joke: Amanda keeps calling

Tyler's wife, Amanda, calls him several times during the run. Each call is a short gag.

- **When:** 3 to 4 calls per run at scripted moments (for example: walking to the car, mid-drive, standing in line at Wawa, pulling into school), with some randomness so runs feel different.
- **How it looks:** Tyler's phone (with the red grip) pops up with "Amanda" on the screen and a ringtone/vibrate animation.
- **Answer or decline:**
  - **Answer:** A short dialogue plays. Her mood is a surprise until he answers: happy, neutral, or "not in a good mood". The player picks one of 2 to 3 replies, which nudges her mood up or down.
  - **Decline:** No time lost, but the next call starts in a worse mood (and possibly with a follow-up text like "??").
  - **While driving:** Calls go through the car's hands-free speaker; dialogue shows as subtitles and the player keeps steering.
- **Cost:** Answering on foot costs a little in-game time. Calls never cause a fail on their own.
- **Tone:** Light, sitcom-style humor (for example, "Did you take the trash out?", "Bring me back a Wawa coffee"). Nothing mean-spirited about Amanda; she is a real person.
- **Payoff:** The results screen shows "Amanda's mood" as a final score line, with a funny closing text from her.
- **Content:** Call scripts live in a data file (`src/data/amanda-calls.json`) so new lines can be added without touching code.

### Win / fail
- **Win:** Tyler reaches the school door before the first bell.
- **Fail:** The first bell rings before he reaches the door. Show a "Tardy" screen.
- **Casual feel:** The timer is generous; average play arrives with a comfortable margin. Failing offers an instant "Retry from last scene" so players never lose much progress. Late arrival is the only way to fail.

### Results screen
- Arrival time vs. first bell.
- Wawa goals: calories (target 1,000) and caffeine (target 300 mg); bonus for Root Beer Ghost.
- Amanda's mood.
- Collisions and school-zone infractions.
- A title based on performance (for example: "Hall Monitor", "Campus Legend").
- "Play again" and "Share" buttons.

## 7. Game state

| Value | Description |
| --- | --- |
| `clock` | In-game time; starts at `startTime` from config, runs at an accelerated rate |
| `firstBell` | 8:00 AM (from config); Tyler must reach the school door by then |
| `amandaMood` | Rises or falls with each call; shown on the results screen |
| `inventory` | Food items (with calories) and Ghost Energy cans (flavor, caffeine) |
| `calories` / `caffeineMg` | Running totals checked against the Wawa goals |
| `energy` | Rises after drinking the Ghost Energy; sets up later scenes |
| `infractions` | Collisions and school-zone speeding |
| `checkpoint` | Last completed scene, used by "Retry" |

## 8. Timing

- First bell: **8:00 AM**.
- Clock starts at **7:00 AM** (proposed), giving 60 in-game minutes.
- Proposed pacing for a ~4 minute run: 1 real second = about 15 in-game seconds. A typical player arrives around 7:45 to 7:50; slow play or many collisions and calls can push past 8:00.
- All of these are tuning values in the config file.

## 9. Configuration (easy to change)

All names and tuning values that may change live in one file: `src/config/game.config.json`. Changing them needs no code edits.

```json
{
  "schoolName": "Red Clay High School",
  "schoolMascot": "Foxes",
  "townName": "Lawrenceville",
  "startTime": "07:00",
  "firstBell": "08:00",
  "clockSpeed": 15,
  "favoriteGhostFlavor": "Root Beer",
  "wawaGoals": { "minCalories": 1000, "minCaffeineMg": 300 },
  "ghostCaffeineMg": 300,
  "minCaloriesPerFoodItem": 500,
  "spouseName": "Amanda",
  "patrolCar": { "doorText": "SHERIFF", "bodyColor": "#1b1f2a", "doorColor": "#f2f2f2" },
  "amandaCallsPerRun": [3, 4]
}
```

- "Red Clay High School" and the mascot are placeholders.
- Every place the school name appears (signs, dialogue, results screen) reads from this file.

## 10. Sound and music

All audio is original or CC0 (public domain), in a chiptune style that matches the pixel art.

### Music (looping tracks)

| Track | Where | Feel |
| --- | --- | --- |
| Title theme | Title screen | Upbeat, Southern-tinged chiptune |
| Morning in Lawrenceville | Walking on the town map | Relaxed, light |
| Patrol | Driving scenes | Faster, driving beat; tempo rises as the clock nears 8:00 |
| Wawa | Inside the store | Cheerful in-store muzak |
| Results / Tardy | End screens | Short win jingle and a "wah-wah" fail jingle |

### Sound effects

Footsteps, car door, engine and tire screech, collision bump, horn, siren and light bar, Wawa door chime, kiosk taps, "order ready" call-out, cooler door, can crack and gulp (Ghost Energy), register beep, school bell, Amanda's ringtone and phone vibrate, text-message ding, UI clicks.

### Audio behavior

- Mobile browsers block audio until the first tap, so the title screen has a "Tap to start" that also unlocks sound.
- Separate toggles for music and sound effects, saved in localStorage.
- Music ducks (gets quieter) during Amanda's calls.
- Respect the phone's silent switch where the browser allows it.

### Tools

- Sound effects: jsfxr (browser sound-effect generator, free).
- Music: BeepBox or similar chiptune tracker, exported to OGG and M4A for cross-browser support.
- Audio budget: about 2 MB of the 5 MB load limit.

## 11. Non-functional requirements

- **Mobile first:** One-thumb controls; touch targets at least 44 x 44 px.
- **Performance:** 60 fps on a mid-range phone from the last ~4 years.
- **Load size:** Under 5 MB on first load.
- **No accounts, no data collection:** Scores and checkpoints stored only in the browser (localStorage).
- **Accessibility:** Readable text at phone size, color is never the only signal, music and sound toggles, and on-screen subtitles for all phone calls.

## 12. Technical approach

- **Language:** JavaScript.
- **3D engine:** Three.js (WebGL). Models are built from primitives in code; no model files.
- **Map:** OpenStreetMap data pre-processed by `scripts/fetch-osm.mjs`; roads and buildings merged into a few large meshes; trees drawn with instancing.
- **Routing:** Dijkstra shortest path over the road graph (`src/map/graph.js`), unit tested.
- **UI:** HTML/CSS overlay.
- **Audio:** Web Audio synthesized chiptune music and effects.
- **Build:** Vite. **Hosting:** GitHub Pages.

## 13. Real people and brands

- The game uses Tyler Ciucci's real name and likeness. Tyler knows about the game.
- Amanda (Tyler's wife) appears as a voice on the phone. She knows about the game. Her jokes stay affectionate.
- **Audience: friends only.** The game is shared by link with friends, not promoted publicly.
- Depiction stays respectful and good-natured.
- The real school name, badge number, and license plate are not shown unless Tyler approves.
- Wawa and Ghost Energy are real brands, referenced by name as an homage. Acceptable for a friends-only, non-commercial fan game; revisit if that changes. No real logos are copied; pixel art suggests the look.
- The GitHub Pages site will be marked `noindex` so it does not show up in search results.

## 14. Out of scope for MVP

- Scenes after arriving at school (hallway patrol, lunch duty, etc.).
- Real-world GPS movement (movement is virtual so anyone can play).
- Multiplayer, leaderboards, or accounts.
- Native app store builds.
