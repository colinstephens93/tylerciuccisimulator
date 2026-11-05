# Requirements

Version 0.6 - 2026-11-05

## 1. Vision

A short, lighthearted, mobile-friendly pixel-art web game that follows Deputy Tyler Ciucci, a School Resource Officer (SRO) in Lawrenceville, Georgia (Gwinnett County, just northeast of Atlanta), through the start of his workday. The tone is affectionate comedy.

Target session length: 3 to 5 minutes for the MVP.

## 2. Platform and audience

- Runs in a mobile web browser (iOS Safari, Android Chrome) with no install.
- Also playable on desktop browsers (keyboard and mouse).
- Primary orientation: portrait.
- Audience: friends, family, and coworkers of Tyler.

## 3. Visual direction

- **Art style:** Pixel art throughout.
- **Walking mode (on foot):** Inspired by the feel of Pokemon Go's map view: Tyler's avatar stays centered on screen on a clean, stylized overhead map of the town, with a slightly tilted perspective, soft colors, simplified roads, and landmark buildings drawn as icons/sprites. Tap the map to walk to a spot (or use an on-screen joystick).
  - All art, icons, and UI are original. We borrow the *feel* (centered avatar on a living town map), not Pokemon Go's actual assets, UI layout, logos, or characters.
- **Driving mode:** A different camera. Top-down, vertically scrolling road behind the wheel of the vehicle (see Scene 2).
- **Interiors:** Buildings Tyler enters (Wawa first) are rendered as their own pixel-art rooms, top-down 3/4 view like a classic handheld RPG interior.

## 4. Character: Tyler Ciucci

Sprite reference is a photo the user supplied (kept out of the repo; see open questions).

| Trait | Description |
| --- | --- |
| Build | Tall, broad, stocky |
| Hair | Short dark brown, neat |
| Face | Full short beard, mustache, serious "on duty" expression |
| Uniform | Black long-sleeve uniform polo, black pants, black belt |
| Badge | Silver six-point star on left chest |
| Gear | Duty belt with flashlight holster; gold badge clipped at the belt |
| Details | Black wristband; phone with a red phone grip (good for idle/selfie animation) |

Sprite needs (MVP):
- Walk cycle in 4 directions (or 8 for the map view).
- Idle animation (checking his phone).
- "Drinking energy drink" reaction.
- Small head portrait for dialogue boxes and the HUD.

Avoid reproducing real agency patches or insignia text on the badge; a generic silver star reads correctly at pixel scale.

## 5. Setting: Lawrenceville, Georgia

- **Real streets:** The town map follows Lawrenceville's real street layout, generated from OpenStreetMap (OSM) data.
  - OSM data is pre-processed at build time into pixel-art tilemaps (roads, blocks, parks, water). The game does not load live map tiles, so it works offline and keeps the pixel look.
  - Major real roads and landmarks are recognizable (for example, the historic downtown square and courthouse, US-29 / Pike St, GA-20 / Buford Dr, GA-316).
  - OSM's license (ODbL) requires credit: the game shows "Map data (c) OpenStreetMap contributors" on the title or credits screen.
- **Tyler's home:** A generic house on a fictional or non-specific residential street. His real address is never used.
- **Wawa:** Made up. A Wawa-style store placed on a real major road in Lawrenceville. No real Wawa exists there; this is creative license.
- **School:** Fictional and renameable (see section 9).
- **Georgia flavor:** Pine trees, red clay, a peach stand, humid haze in the morning light.

## 6. MVP gameplay: "The Morning Run"

The game alternates between walking mode and driving mode.

### Scene 1 - Leaving home (walking)
- Tyler starts outside his house on the town map. Short tutorial: tap to walk to the vehicle.
- Clock starts at 7:00 AM (configurable).

### Scene 2 - Drive to Wawa (driving)
- Vehicle: a **marked patrol car** (see "Patrol car" below).
- Top-down, vertically scrolling road.
- Controls: tap/hold left or right half of the screen to steer; desktop uses arrow keys / A-D.
- Hazards: civilian traffic, potholes, a slow pickup truck, a school bus.
- Collisions cost time; they never end the game.
- End: pull into the Wawa lot.

### Patrol car

- Pixel-art marked patrol car: dark body with white doors, "SHERIFF" lettering, roof light bar, push bumper.
- Generic markings only: no real agency seal, unit number, or plate. Livery colors and door text are set in the config file.
- **Lights button (proposed):** Tapping it turns on the light bar and siren, and traffic pulls aside. Using it for a breakfast run is not an emergency, so each use adds an infraction (and possibly an Amanda-style text from "Sarge"). Risk/reward for players who are running late.
- Light bar flashes on the parked car outside Wawa and the school as an idle detail.

### Scene 3 - Wawa (walking, then interior)
- Walk across the parking lot on the map and into the front door.
- Interior is a rendered pixel-art Wawa-style store: entrance, touchscreen ordering kiosks, deli counter, drink coolers, checkout.
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
- Same driving engine, new route.
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

## 12. Technical approach (proposed)

- **Language:** JavaScript.
- **Engine:** Phaser 3 (canvas rendering, pixel-perfect scaling, touch input, scene management, tilemaps).
- **Maps:** Town map and Wawa interior built as tilemaps (Tiled editor format), so layouts can be edited without code changes.
- **Real-streets pipeline:** A build script downloads an OSM extract of Lawrenceville (Overpass API), converts roads and areas into a tile grid, and writes a Tiled map. Hand-placed buildings (home, Wawa, school) are added on a separate layer.
- **Build:** Vite for local dev and bundling.
- **Hosting:** GitHub Pages from this repository.
- **Art pipeline:** Placeholder shapes first, then pixel sprites (Aseprite or similar), at a base resolution of 16x16 or 32x32 tiles scaled up with nearest-neighbor.

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
- Real-world GPS / location-based play.
- Multiplayer, leaderboards, or accounts.
- Native app store builds.
