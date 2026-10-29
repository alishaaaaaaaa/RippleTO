# Ripple TO

**See how a city decision ripples through Toronto, one household at a time.**

Ripple is a civic scenario simulator. Pick a real Toronto decision, press the big red button to enact it, and watch 12 AI residents live through it on a map, month by month. You can see who comes out ahead, who pays, and who gets missed, then **call any resident** to ask why, and generate a **neutral ward briefing** for residents, journalists or councillors.


| Scenario | Question | Tracks |
|---|---|---|
| 🚌 **RapidTO: Jane Street bus lanes** | Who actually gets time back, and who pays for it? | Climate · School of Cities · AI for Social Impact |
| 🏠 **Rent pressure near new transit** | What does "affordable" mean once you add the commute, and which renter protections keep people housed for the least money? | Sustainable FinTech · School of Cities · AI for Social Impact |
| 🌡️ **Five-day extreme heat warning** | Can the people who need cool spaces most actually reach one, especially overnight? | Healthcare · Climate · School of Cities · AI for Social Impact |
| ✦ **Your own idea** | Type any policy in plain English; AI turns it into a runnable scenario. | — |

---

## Quick start

```bash
npm install
cp .env.example .env.local      
npm run dev
```

- **Resident voices (optional):** add `ELEVENLABS_API_KEY` to give each of the 12 residents their own ElevenLabs voice on phone calls (casting is in `lib/voices.ts`). Gemini still writes every answer; ElevenLabs only speaks it. Without the key, the browser's built-in voice is used.
- **Map views** (switch in the bottom-right corner of the map):
  - **Real 3D**: Google Photorealistic 3D Tiles, the actual 3D-scanned Toronto. Needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with the *Map Tiles API* enabled; setup steps are in `.env.example`. It falls back to Model automatically if the key is missing or rejected.
  - **Model**: real OpenStreetMap building footprints and heights, painted in realistic materials. No key needed.
  - **2D**: a flat map.
  - The **Camera** panel (top right) rotates, tilts, zooms, auto-orbits and resets the view. You can also right-drag or Ctrl-drag the map.


## Controls (keyboard = hardware panel)

| Key | Panel control | Action |
|---|---|---|
| → / ← | Turn knob | Next / previous month |
| Space | Press knob | Play / pause |
| A / D | Safety cover toggle up / down | Arm / disarm |
| E or Enter | Big red button | Enact the policy (must be armed) |
| B | — | Compare: status quo ↔ with policy |
| I | — | Call the selected resident |
| 1 / 2 / 3 | — | Switch scenario |

---

## How it works

```
                ┌───────────────────────────────┐
 Scenario file  │  lib/scenarios/*.ts           │  events, overlays, params, metrics, sources
                └──────────────┬────────────────┘
                               ▼
                ┌───────────────────────────────┐
 Rules engine   │  lib/engine/model.ts          │  status quo run + policy run, every number
                │  (pure TS, runs in browser)   │  with plain-language "drivers" (the why)
                └──────────────┬────────────────┘
                               ▼
                ┌───────────────────────────────┐
 AI layer       │  /api/agent      ×12 parallel │  each resident's inner voice per month
 (Gemini, with  │  /api/interview               │  grounded phone call with a resident
  template      │  /api/briefing                │  neutral ward briefing (markdown)
  fallbacks)    │  /api/scenario                │  plain English → scenario params
                └──────────────┬────────────────┘
                               ▼
                ┌───────────────────────────────┐
 UI             │  Zustand store + Leaflet map  │  timeline, metrics, residents, console
                └───────────────────────────────┘
```

**Design principle: rules do the math, AI does the language.** Every number on screen (minutes saved, % of income, heat risk) comes from a transparent rules engine and can be explained. Gemini only writes residents' voices and briefings *from* those results, and is told never to invent figures. This is the answer to "is the AI making things up?", and it's what the "responsible interpretation" judging criterion rewards.

### The three models

- **Transit.** Each household's trip time changes by the share of their trip on Jane Street, using the City's published segment estimates (~8–9 min faster for buses, ~6–7 min slower for cars at peak). Drivers' chance of switching to the bus comes from a logit model on time-plus-money cost, with value of time scaled to income. Removed stops add walking time. Doing nothing isn't neutral: without lanes, buses slowly get slower.
- **Housing.** Renters renew yearly. In redevelopment-pressure areas, rents jump at renewal; elsewhere they rise near the guideline. Housing **plus transport** cost is compared with income. Sustained spending over 65% forces a move: younger singles double up, others move further out and commute longer. The policy combines building protection (non-profit acquisition), enforcement and a targeted monthly benefit, and the engine reports **cost per household kept housed**.
- **Heat.** Risk builds up across hot periods and depends on AC, age, living alone, chronic illness and floor height. Indoor heat lingers overnight. Each household can reach the nearest *open* cool space only within its walking range, car, or (under the policy) free transit or an outreach ride. Isolated seniors don't go unless someone contacts them.

### Project layout

```
app/
  page.tsx                 landing page + custom scenario
  sim/page.tsx             main simulator
  briefing/page.tsx        ward briefing (print to PDF)
  api/agent|interview|briefing|scenario|health/route.ts
components/                SimMap, PersonaPanel, MetricsPanel, ControlConsole, InterviewDialog, …
lib/
  types.ts                 shared data model
  scenarios/               one file per scenario (+ index.ts registry)
  data/                    neighbourhoods.ts, personas.ts  ← replace with real data (docs/DATA.md)
  engine/model.ts          the rules engine
  engine/templates.ts      offline fallbacks
  ai/                      Gemini wrapper + grounded prompt context
  store.ts, useControls.ts
hardware/                  Pico firmware (code.py) + wiring guide
docs/                      DATA.md, PITCH.md, IMPROVEMENTS.md
```

## Responsible design

- **Composite residents, not real people**, with fictional first names. No race or ethnicity fields: outcomes are driven by circumstances (income, tenure, car access, age, health, building type).
- **Directional, not a forecast.** Every scenario lists its assumptions, limitations and sources (the **Data & limits** button).
- **Non-partisan.** No candidate predictions or endorsements. Briefings end with neutral questions residents can ask *any* candidate.
- **Illustrative data is labelled as such** until replaced with Census figures (see [docs/DATA.md](docs/DATA.md)).


Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors © [CARTO](https://carto.com/attributions).
