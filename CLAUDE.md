# ps247 — Drone & Counter-Drone Threat Simulation Trainer

Smart India Hackathon 2026 entry. Problem statement **SIH26247**, Ministry of Defence,
Defence Services Staff College. Category: Software. Theme: Robotics and Drones.

Idea submission deadline: **20 October 2026** (portal table says 5 October; the
homepage banner for these 20 new statements says 20 October — confirm with SPOC).
Target: submit by 18 October, not the last day.

## What this product actually is

A **training assessment system whose interface happens to be a 3D simulation** —
not a drone shooting game. The trainee's *decisions* are scored, never their aim.
There is no crosshair, no shooting mechanic. If a change makes this feel more like
a game and less like a graded exercise, it is the wrong change.

The customer is a training college. There are two users:

| User | Needs | Surface |
|---|---|---|
| Trainee | Run simulation sessions | `/simulator` — 3D, React Three Fiber |
| Instructor | Assign scenarios, review performance over time | `/dashboard` — plain React + Recharts |

Both live in one Next.js app, one database, one deployment. Not two repos.

## The three graded skills

The PS asks for "recognizing, classifying and responding". These are scored separately:

1. **Detect** — time from drone spawn to the trainee flagging it. Harder at night.
2. **Classify** — which drone type is it? A false positive is a real failure, not a
   minor one. Engaging the civilian decoy must cost the trainee points.
3. **Respond** — which counter-measure. Scored against a plain decision tree
   (`CORRECT_RESPONSE` in `lib/models.js`), deliberately not an ML model, so it can
   be shown on a slide and defended to a judge.

## Scope — locked, do not expand

- **3 drone types**: `quad_recon`, `fixedwing_kamikaze`, `decoy_civilian`
- **3 counter-measures** + no-action: `jam`, `intercept`, `report_only`, `no_action`
- **2 conditions**: day / night (terrain field exists but urban/rural is Phase 2)
- **3 metrics**: detection time, classification accuracy, response correctness
- **Difficulty**: instructor sets a base level; system adapts from the last 3 sessions

Anything not on this list does not get built before 20 October. A mobile companion
app appears on the architecture slide as Phase 2 only — do not start it.

## Stack

- Next.js (JavaScript, not TypeScript — chosen for speed), Tailwind
- MongoDB Atlas free tier M0, Mongoose
- `@react-three/fiber` + `@react-three/drei` for the simulator
- `recharts` for the dashboard
- Deploy on Vercel

Chosen over Supabase/Postgres because the session record is deeply nested
(session → events[]) and the schema will change several times during the build.

## Data contract

`lib/models.js` is the contract between the two halves: the simulator writes a
`Session`, the dashboard reads it. **Change it on both sides or not at all.**

Key fields worth knowing:

- All event times are **milliseconds from session start**, never wall clock.
- `scenarioSeed` is stored per session. This gives replay, and it is the direct
  answer to the PS requirement "prevent rote learning" — the seed never repeats.
- `verdict` on each event is what the dashboard filters on:
  `correct | misclassified | wrong_response | false_positive | missed`
- `scores.composite` (0–100) is the headline number. Weights are 25/35/40 across
  detection/classification/response, with penalties for false positives and misses.
  These weights are first-pass guesses — recalibrate after playtesting.

## Build order

1. ~~Session schema~~ (done — `lib/models.js`)
2. Mongo connection helper + API routes: `POST /api/sessions`, `GET /api/trainees/[id]`
3. Simulator **vertical slice**: one drone spawns, click to detect, classify,
   respond, session saves. End to end before any variety is added.
4. Dashboard reads that saved session
5. Then variety: 3 drone types, day/night, difficulty levels
6. Polish and screenshots

Build the loop end to end first. Do not build features in isolation — half-finished
pieces produce no demo-worthy screenshot.

## Where polish matters

Screenshots go in the PPT and a 60–90 second YouTube video. Visual effort belongs
in: lighting, fog, drone motion trails, and a clean HUD. Not in realistic drone
models — recognisable silhouettes are enough and are actually what the trainee is
being tested on.

## Constraints from the PS text

- "Minimal specialized hardware" — must run in a browser on an ordinary unit PC.
  No VR headset, no gaming GPU assumptions.
- No official dataset and no explainer video were provided. All scenario data is
  generated. Drone speeds and engagement ranges need a little real research so the
  numbers are defensible, but nothing is downloadable.

## Working style

Push back when something looks wrong rather than agreeing by default. Flag
scope creep against the locked list above. The deadline is real and short.
@AGENTS.md
