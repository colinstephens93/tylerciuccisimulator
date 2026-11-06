# Decisions Log

| # | Date | Decision | Reason |
| --- | --- | --- | --- |
| 1 | 2026-11-05 | Mobile-first web game, playable in the browser | Easy to share by link, no install |
| 2 | 2026-11-05 | (Superseded by #37) MVP = drive to Wawa, order breakfast + energy drink, drive to school | Initial game concept |
| 3 | 2026-11-05 | Requirements and decisions are documented in this repo under `docs/` | Single source of truth |
| 4 | 2026-11-05 | Officer is named Tyler Ciucci; sprite based on a user-supplied photo | User request |
| 5 | 2026-11-05 | Breakfast is always a breakfast sandwich; drink is always Ghost Energy | Matches Tyler's real routine |
| 6 | 2026-11-05 | Setting is a real Georgia town just outside Atlanta | User request |
| 7 | 2026-11-05 | Arriving after the first bell is a fail; otherwise casual (generous timer, collisions cost time only, instant retry from last scene) | Stakes without frustration |
| 8 | 2026-11-05 | (Superseded by #29) Pixel art | User request |
| 9 | 2026-11-05 | (Superseded by #29-30) On foot: centered-avatar town map; driving in a separate top-down view | User request |
| 10 | 2026-11-05 | Tyler walks into a rendered Wawa interior to order | User request |
| 11 | 2026-11-05 | Town is Lawrenceville, GA | User choice |
| 12 | 2026-11-05 | Wawa is made up (no real Wawa in Lawrenceville) | Creative license approved by user |
| 13 | 2026-11-05 | Town map follows real streets via OpenStreetMap, pre-processed into pixel tilemaps; OSM credit shown | Real streets requested; offline-friendly and keeps pixel art |
| 14 | 2026-11-05 | Tyler knows about the game | Confirmed by user |
| 15 | 2026-11-05 | Favorite Ghost Energy flavor is Root Beer (bonus when chosen) | User input |
| 16 | 2026-11-05 | Running joke: wife Amanda keeps calling, mood unknown until answered | User input |
| 17 | 2026-11-05 | School name is fictional and set in `src/config/game.config.json` | Must be easy to change |
| 18 | 2026-11-05 | First bell is 8:00 AM | User input |
| 19 | 2026-11-05 | Tyler's real home address is not used | Privacy |
| 20 | 2026-11-05 | Audience is friends only; site marked noindex | User input |
| 21 | 2026-11-05 | Amanda knows she is in the game | Confirmed by user |
| 22 | 2026-11-05 | Tyler drives a marked patrol car with generic markings | User choice; avoids real agency insignia |
| 23 | 2026-11-05 | MVP includes music and sound effects (original or CC0 chiptune) | User request |
| 24 | 2026-11-05 | Clock starts at 7:00 AM | User input |
| 25 | 2026-11-05 | Any breakfast item counts; each food item is at least 500 calories | User input |
| 26 | 2026-11-05 | Wawa goals: at least 1,000 calories of food and 300 mg caffeine; each Ghost can is 300 mg | User input |
| 27 | 2026-11-05 | Under 1,000 calories lowers the score; going over either goal has no penalty | User input |
| 28 | 2026-11-05 | Language is JavaScript | Default accepted |
| 29 | 2026-11-05 | Switch from 2D pixel art to smooth 3D in the style of a location-based map game (Pokemon Go-like genre), with original art and UI | User request |
| 30 | 2026-11-05 | Driving uses the same 3D world, along real routed streets | User choice |
| 31 | 2026-11-05 | Movement is virtual (tap/drag), not real GPS | Friends outside Lawrenceville can play |
| 32 | 2026-11-05 | Engine changed from Phaser to Three.js | Phaser is 2D-only |
| 33 | 2026-11-05 | Places: house on Honeysuckle Ave (random, not his address), Wawa on West Pike St, school on New Hope Rd | Good real routes through downtown |
| 34 | 2026-11-05 | Ground layers (roads, curbs, parks) drawn as unlit, ordered decals | Removes road flicker and jagged patches on phone GPUs |
| 35 | 2026-11-05 | Drive routes smoothed into curves; car auto-slows for tight corners | Removes sideways jerks at corners |
| 36 | 2026-11-05 | clockSpeed lowered from 15 to 12 | Corner slowdowns made drives longer; keeps typical arrival near 7:45 |
| 37 | 2026-11-06 | Refactor into a free-roam sandbox (free driving and running, any car, light chaos, short missions) instead of the linear Morning Run | New core vision: open-city sandbox feel |
| 38 | 2026-11-06 | Touch controls: floating virtual joystick + action buttons; camera-relative movement on foot, joystick steer/throttle in cars | Standard, one-hand-each mobile controls |
| 39 | 2026-11-06 | The Morning Run and the Amanda gag live on as missions; the Wawa interior, clock/bell, Amanda mood calls and Wawa scoring were removed | Fit the sandbox loop; keep the jokes |
| 40 | 2026-11-06 | Chaos raises a HEAT meter; full heat sends "Sarge" after you, and getting caught costs coins | Consequences for chaos without game over |
| 41 | 2026-11-06 | Pedestrians are knocked flying cartoon-style and always get back up | Keeps the tone light |
| 42 | 2026-11-06 | Coins are the score; 20 hidden Ghost cans are the collectible set | Exploration reward loop |
| 43 | 2026-11-06 | Missions are data in `src/data/missions.json`, validated by tests | Easy to add more without code |
| 44 | 2026-11-06 | Keep the full real Lawrenceville map; only simulate traffic and people near the player | Recognizable town; phone performance |
| 45 | 2026-11-06 | Tyler uses a detailed, realistically proportioned model (mustache, plate carrier, short sleeves) matching the reference photo; the rest of the world stays cartoon | User request: Tyler should look much more like the photo |
| 46 | 2026-11-06 | The Morning Run starts with a stop at El Cregs (flauta food truck on West Pike Street) to meet ATF Agent Dan on foot, before Wawa | User request; adds a `meet` stage type |
| 47 | 2026-11-06 | Dan gets a realistic model matching his reference photos (Tyler's style, a bit larger); photos are not committed | User request |
| 48 | 2026-11-06 | Dan Reiner knows he's in the game; El Cregs is made up; Dan's dialogue approved; no cigar; townspeople stay cartoon-styled | User answers |
| 49 | 2026-11-06 | Last names on uniforms: CIUCCI name tape on Tyler's vest, REINER on Dan's windbreaker | User request |
