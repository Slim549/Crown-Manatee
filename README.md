# Manatee County Government Game — base build

Zero-dependency Node (v18+) server + vanilla-JS client. Realtime uses Server-Sent Events; the **server is the game authority** (scores answers, enforces timers, hides answers until a question closes).

## Run
```
npm start            # http://localhost:3000   (PORT=xxxx to change)
npm test             # automated multiplayer flow check (spawns its own server)
npm run validate     # checks the question bank and prints a report
```
- **Host:** open `/host` on the projector → *Create game session* → join code appears. (Refreshing the host page resumes the session.)
- **Players:** open `/play` (or `/play?code=ABCD`) on their own devices, enter code + name. Same-network devices use the host machine's LAN IP.
- **Flow:** Open area selection → players pick exactly 3 areas (changeable until lock) → Lock → Start → per question the host can Pause/Resume, Close, **Next ▶**; End game / Reset ask for confirmation.

## Where things live
| What | File |
|---|---|
| Rules, scoring function, defaults (timer 20s, 3 Qs/player/node, 1 pt, no speed bonus, shared-winner ties, min players) | `config/gameConfig.js` |
| 10 building names/focus (exact names) | `config/nodes.js` |
| **All image paths, building positions, label positions, tag positions/stack direction, audio paths** | `public/assets.js` |
| Images (your supplied art, untouched) | `public/assets/board/`, `public/assets/buildings/`, `public/assets/ui/` |
| Repaired sprites used on the board | `public/assets/processed/` — rebuild with `npm run assets` (`scripts/process_assets.py`) |
| Original golden-herald pack | `assets-source/golden-herald/` |
| Question bank loader + validator | `config/questionBank.js` |
| Server / state / scoring / privacy | `server.js` |
| Host board, player screens, FinalScoreboard | `public/app.js` · styles `public/style.css` · audio `public/audio.js` |

## Question bank
Put your real bank at **`data/questions.json`** (it overrides the sample automatically) in the shape from the build prompt: an array of `{nodeId, nodeName, questions:[{id,difficulty,prompt,choices:{A,B,C,D},correctAnswer,explanation?}]}`. Node ids: `judicial-center, elections, gt-bray, school-district, sheriff, county-admin, library, property-appraiser, animal-welfare, public-works`.
Validation (30/node, 10/10/10 difficulty, 4 non-empty choices, one A–D key, unique ids) logs a report at startup; malformed questions are skipped, the game still runs.
`data/questions.json` is the imported bank from the Manatee County question document (300 questions, answer key included). `data/questions.sample.json` is unused placeholder text.

## Audio
Drop files in `public/assets/audio/` matching names in `public/assets.js` (`intro.mp3, game.mp3, tick.mp3, …`). Missing files are silent. There is no volume or mute control on the screens.

## Known limitations / next steps
- State is in memory (a server restart ends sessions); one Node process. For a public website add persistence + a host (Render/Fly/etc.) — SSE works behind most proxies.
- Each player moves through their own questions. A personal timer never holds the rest of the room. After 5 questions at a building they can keep going for the crown or move on.
- The board uses `board-empty.png` with live HTML labels (so names are exact and tags can move); `board-reference.png` is kept for comparison. Timer pill is drawn in HTML on the board.
- Waiting-area slots fit ~8 players on the board; larger classes will need a second row layout (`HOME` in `assets.js`). Host panel has no node-order editor yet (server supports `settings.nodeOrder`).
- No auth beyond the host key stored in the host's browser; no QR code yet.
