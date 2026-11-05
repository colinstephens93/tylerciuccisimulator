# Requirements

Version 0.2 (draft) - 2026-11-05

## 1. Vision

A short, lighthearted, mobile-friendly pixel-art web game that follows Deputy Tyler Ciucci, a School Resource Officer (SRO) in a real town just outside Atlanta, Georgia, through the start of his workday. The tone is affectionate comedy.

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

## 5. Setting

- A real town just outside Atlanta (to be chosen; see open questions).
- Note: As of current reporting, Wawa's Georgia stores are in south and coastal Georgia, not metro Atlanta. The game will place a Wawa in the chosen town as creative license unless the user prefers otherwise.
- Georgia flavor on the map: pine trees, red clay, a peach stand, humid haze in the morning light.

## 6. MVP gameplay: "The Morning Run"

The game alternates between walking mode and driving mode.

### Scene 1 - Leaving home (walking)
- Tyler starts outside his house on the town map. Short tutorial: tap to walk to the vehicle.
- Clock starts at 6:30 AM.

### Scene 2 - Drive to Wawa (driving)
- Top-down, vertically scrolling road.
- Controls: tap/hold left or right half of the screen to steer; desktop uses arrow keys / A-D.
- Hazards: civilian traffic, potholes, a slow pickup truck, a school bus.
- Collisions cost time; they never end the game.
- End: pull into the Wawa lot.

### Scene 3 - Wawa (walking, then interior)
- Walk across the parking lot on the map and into the front door.
- Interior is a rendered pixel-art Wawa-style store: entrance, touchscreen ordering kiosks, deli counter, drink coolers, checkout.
- Tasks, in any order:
  1. **Breakfast sandwich:** At the kiosk, build a breakfast sandwich (bread, egg, meat, cheese, extras). Wait for the order number to be called at the counter.
  2. **Ghost Energy:** Walk to the cooler and pick a Ghost Energy flavor.
  3. **Checkout:** Pay at the register.
- Light flavor: other customers in line, a "your order is ready" call-out.
- Exit back to the vehicle.

### Scene 4 - Drive to school (driving)
- Same driving engine, new route.
- School-zone hazards: reduced speed limit, crossing guard, buses, car-rider line.
- Speeding in the school zone adds an infraction (score penalty, not a fail).

### Scene 5 - Arrive at school (walking)
- Park, walk to the front entrance. Reaching the door stops the clock.

### Win / fail
- **Win:** Tyler reaches the school door before the first bell.
- **Fail:** The first bell rings before he reaches the door. Show a "Tardy" screen.
- **Casual feel:** The timer is generous; average play arrives with a comfortable margin. Failing offers an instant "Retry from last scene" so players never lose much progress. Late arrival is the only way to fail.

### Results screen
- Arrival time vs. first bell.
- Breakfast and drink collected.
- Collisions and school-zone infractions.
- A title based on performance (for example: "Hall Monitor", "Campus Legend").
- "Play again" and "Share" buttons.

## 7. Game state

| Value | Description |
| --- | --- |
| `clock` | In-game time, starts 6:30 AM, runs at an accelerated rate |
| `firstBell` | Time Tyler must reach the school door by |
| `inventory` | Breakfast sandwich (with its build), Ghost Energy (flavor) |
| `energy` | Rises after drinking the Ghost Energy; sets up later scenes |
| `infractions` | Collisions and school-zone speeding |
| `checkpoint` | Last completed scene, used by "Retry" |

## 8. Non-functional requirements

- **Mobile first:** One-thumb controls; touch targets at least 44 x 44 px.
- **Performance:** 60 fps on a mid-range phone from the last ~4 years.
- **Load size:** Under 5 MB on first load.
- **No accounts, no data collection:** Scores and checkpoints stored only in the browser (localStorage).
- **Accessibility:** Readable text at phone size, color is never the only signal, sound off by default with a toggle.

## 9. Technical approach (proposed)

- **Engine:** Phaser 3 (canvas rendering, pixel-perfect scaling, touch input, scene management, tilemaps).
- **Maps:** Town map and Wawa interior built as tilemaps (Tiled editor format), so layouts can be edited without code changes.
- **Build:** Vite for local dev and bundling.
- **Hosting:** GitHub Pages from this repository.
- **Art pipeline:** Placeholder shapes first, then pixel sprites (Aseprite or similar), at a base resolution of 16x16 or 32x32 tiles scaled up with nearest-neighbor.

## 10. Real people and brands

- The game uses Tyler Ciucci's real name and likeness. He should agree before it is shared beyond a small circle.
- Depiction stays respectful and good-natured.
- The real school name, badge number, and license plate are not shown unless Tyler approves.
- Wawa and Ghost Energy are real brands, referenced by name as an homage. Fine for a private, non-commercial fan game; revisit if the game is shared publicly or monetized.

## 11. Out of scope for MVP

- Scenes after arriving at school (hallway patrol, lunch duty, etc.).
- Real-world GPS / location-based play.
- Multiplayer, leaderboards, or accounts.
- Native app store builds.
