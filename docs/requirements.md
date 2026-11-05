# Requirements

Version 0.1 (draft) - 2026-11-05

## 1. Vision

A short, lighthearted, mobile-friendly web game that follows a School Resource Officer (SRO) in Georgia through the start of a workday. The officer character is modeled on a real person (see section 7, "Real-person likeness"). The tone is affectionate comedy, not satire of law enforcement or schools.

Target session length: 3 to 5 minutes for the MVP.

## 2. Platform and audience

- Runs in a mobile web browser (iOS Safari, Android Chrome) with no install.
- Also playable on desktop browsers (keyboard and mouse).
- Primary orientation: portrait.
- Audience: friends, family, and coworkers of the person the officer is modeled on.

## 3. MVP gameplay: "The Morning Run"

The MVP is three sequential scenes. Each scene has a clear goal and ends with a transition to the next.

### Scene 1 - Drive to Wawa

- **Goal:** Drive the patrol vehicle from home to a Wawa in Georgia.
- **View:** Top-down, vertically scrolling road (fits portrait screens).
- **Controls:** Tap or hold left/right sides of the screen to steer; desktop uses arrow keys / A-D.
- **Obstacles:** Civilian traffic, potholes, a school bus, a slow pickup truck.
- **Constraints:** A game clock is always running (starts around 6:30 AM). Collisions cost time.
- **End:** Pull into the Wawa parking lot.

### Scene 2 - Order at Wawa

- **Goal:** Order breakfast and an energy drink.
- **View:** A stylized touchscreen ordering kiosk (a nod to the real Wawa ordering experience).
- **Flow:**
  1. Choose a breakfast item (for example: breakfast sandwich, sizzli, bowl, hoagie).
  2. Customize it (bread, egg, cheese, meat, toppings).
  3. Grab an energy drink from the cooler (choose a flavor).
  4. Pay and pick up the order.
- **Scoring idea:** The officer has a "usual" order. Matching it earns a bonus; the order shown as a hint in a thought bubble or a text from a friend.
- **End:** Walk back to the vehicle with the food.

### Scene 3 - Drive to school

- **Goal:** Reach the school before the first bell.
- **View:** Same driving engine as Scene 1, with a different route and hazards (school zone speed limit, crossing guard, buses, car-rider line).
- **Twist idea:** Driving too fast in the school zone costs points; the SRO is supposed to set the example.
- **End:** Park at the school. Show a results screen.

### Results screen

- Arrival time vs. first bell.
- Order accuracy.
- Collisions / infractions.
- A letter grade or title (for example: "Hall Monitor", "Campus Legend").
- "Play again" and "Share" buttons.

## 4. Game state

| Value | Description |
| --- | --- |
| `clock` | In-game time, starts ~6:30 AM, advances in real time at an accelerated rate |
| `energy` | Officer's energy meter; rises after the energy drink, drains slowly |
| `hunger` | Drops after breakfast |
| `orderAccuracy` | How closely the order matched the "usual" |
| `infractions` | Collisions and school-zone speeding |

`energy` and `hunger` are not critical for the MVP but set up later workday scenes.

## 5. Non-functional requirements

- **Mobile first:** All controls usable with one thumb; touch targets at least 44 x 44 px.
- **Performance:** 60 fps on a mid-range phone from the last ~4 years.
- **Load size:** Under 5 MB total on first load.
- **Offline-tolerant:** Works after first load if the connection drops (optional for MVP).
- **No accounts, no data collection:** Scores stored only in the browser (localStorage).
- **Accessibility:** Readable text at phone size, color is never the only signal, sound off by default with a toggle.

## 6. Technical approach (proposed)

- **Engine:** Phaser 3 (handles canvas rendering, scaling, touch input, and scenes).
- **Language:** JavaScript (or TypeScript, if preferred).
- **Build:** Vite for local dev and bundling.
- **Hosting:** GitHub Pages from this repository.
- **Art:** Simple pixel art or flat vector shapes; placeholders first.

## 7. Real-person likeness

The officer is modeled on a specific real person. Requirements:

- The person has agreed to being in the game (or will before it is shared publicly).
- Depiction is respectful and good-natured; no content that could embarrass them professionally.
- No real identifying details beyond what they approve (for example: the actual school name, badge number, or license plate).
- Real brands (for example, Wawa) are referenced in a parody/homage way; see open question about using the real name and logo.

## 8. Out of scope for MVP

- Scenes after arriving at school (hallway patrol, lunch duty, etc.).
- Multiplayer, leaderboards, or accounts.
- Native app store builds.
