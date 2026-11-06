# Requirements

Version 1.0 - 2026-11-06 (free-roam sandbox refactor)

## 1. Vision

A lightweight, single-page web game with the free-roaming sandbox feel of early-2000s open-city games: drive or run around a small stylized city, cause light chaos, complete short missions, and explore. Playable instantly on iPhone from a static GitHub Pages site (pure client-side HTML/CSS/JS, no backend).

The player is Deputy Tyler Ciucci, a School Resource Officer, in Lawrenceville, Georgia. The tone is affectionate, arcade, cartoonish and lightly chaotic, never realistic or mean.

## 2. Platform and audience

- Mobile web first (iOS Safari), also desktop browsers. No install, no accounts.
- Portrait and landscape both work.
- Audience: friends, family and coworkers of Tyler. Shared by link; site is `noindex`.

## 3. Gameplay

### Movement
- **Third-person camera** behind Tyler or his car; drag to orbit, pinch to zoom; walls pull the camera in so the player stays visible.
- **On foot:** floating virtual joystick (camera-relative), JUMP and KICK buttons. Light push = walk, full push = run.
- **Driving:** joystick x steers, y is gas/brake/reverse. DRIFT (handbrake) for slides, HORN, SIREN in the patrol car. Arcade physics: grip, drift, bounces off walls, slower off-road.
- **Any car:** the patrol car starts parked at home; any traffic car can be taken ("official business"). Bail out at speed for a tumble.

### Living city
- Real Lawrenceville streets and building footprints from OpenStreetMap, with collisions.
- AI traffic follows lanes and one-way streets, brakes for obstacles and pulls over for the siren. Hard hits wreck cars (they slide and become drivable).
- Pedestrians walk the sidewalks, dodge speeding cars, and are knocked flying (cartoon, no injury) when hit or kicked, then get up.
- Breakable street props along every road; smashing them spills coins that magnet to the player. Props reappear later.

### Chaos and consequences
- A HEAT meter fills with chaos (props, pedestrians, wrecks, carjacking) and drains after a calm spell.
- Full heat starts a pursuit by "Sarge". If Sarge rams the car or tackles Tyler: BUSTED, a 10% coin fine (minimum 10) and any mission fails. Staying far away drains the meter and ends the pursuit.

### Missions
- Started by walking or driving slowly into a yellow `!` marker, which shows a short brief from a character (Amanda, Sarge, Coach, the Wawa clerk). Players can decline.
- Stage types: `reach` (timed drive to a place, with GPS arrow, beacon and mini-map route), `meet` (get to a character, stop, get out and walk up to them for a short conversation; the timer pauses while talking), `collect` (grab N cans scattered nearby), `smash` (break N props), `pursuit` (ram a fleeing car N times before it escapes).
- Each stage has its own timer. Rewards are coins; best times are saved. Failing offers Retry (from the mission start) or back to free roam.
- Data-driven: `src/data/missions.json`, validated by unit tests.

### Collectibles
- Coins from smashing and wrecking; coin total is the player's score.
- 20 hidden Ghost Energy cans at fixed spots (same for every player), each with a light column. Collecting one gives 10 coins and a short speed boost. Collected cans are remembered.

## 4. Visual and animation style

- Stylized cartoon 3D: toon shading, bright saturated colors, chunky shapes, big heads and hands.
- Pastel buildings with darker roofs, bright green ground, gradient morning sky with warm haze.
- Snappy, exaggerated animation: squash and stretch on jumps and landings, run cycles with bob and lean, car body roll and pitch, springy impact squash, tumbling pedestrians and props, camera shake and FOV kick at speed, dust puffs, sparks, confetti, pop-up comic text ("SMASH!", "OOF!").
- Clean HUD for small screens: round rotating mini-map with route and markers, heat meter, coin and can counters, mission card with timer, speedometer, toasts and slam-in banners.

## 5. Character and setting

- Tyler (modeled on the reference photo, realistic proportions and soft physically based shading, a little larger than life so he reads on a phone): stocky build, short dark-brown hair with faded sides, full mustache with light stubble, black short-sleeve uniform shirt, black plate-carrier vest (silver six-point star, blank name tape, magazine and radio pouches, body camera, flashlight), clear coil earpiece, black duty pants and boots, duty belt with a gold star badge and holster, black watch on the left wrist, bracelet on the right, phone with a red grip in his right hand. No real agency patches, names or numbers. Other characters stay cartoon-styled.
- Patrol car: dark body, white doors, "SHERIFF" text, light bar. Generic markings only (set in config).
- Places: a generic house on Honeysuckle Avenue (not his address), El Cregs (a made-up flauta food truck on West Pike Street where ATF Agent Dan hangs out), a made-up Wawa on West Pike Street, a fictional school on New Hope Road (name in config), and the courthouse square.
- Amanda (Tyler's wife) appears only as affectionate mission briefs.
- ATF Agent Dan: Tyler's friend, waits at El Cregs in a navy "ATF" windbreaker, khakis, cap and sunglasses. The Morning Run starts by meeting him (it's about flautas, not a case). In free roam he chats when Tyler walks up.

## 5a. Technical constraints

- Static site: Vite build, deployed to GitHub Pages. No server, no live map tiles.
- Three.js; all models, textures and sounds generated in code. Target well under 1 MB gzipped.
- Phone performance: merged city mesh, instanced trees and props, pooled particles and coins, traffic and pedestrians only near the player, mini-map pre-rendered once, pixel ratio capped (config).
- Saves and settings in localStorage only.
- Map data credit shown on the title screen (ODbL).

## 6. Real people and brands

- Tyler and Amanda know about the game; depiction stays respectful and good-natured.
- Wawa and Ghost Energy are referenced by name as a friends-only, non-commercial homage; no real logos.
- No real school name, badge number or plate unless Tyler approves.

## 7. Out of scope (for now)

- Multiplayer, leaderboards, accounts.
- Interiors (the old Wawa interior scene was removed in the sandbox refactor).
- Native app builds.
