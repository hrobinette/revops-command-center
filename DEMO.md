# Demo Runbook — RevOps Command Center

## The pitch (memorize this)

> "Sales reps miss deal-killing gaps — a missing decision-maker, a champion going
> quiet — and nobody notices until the deal stalls at the QBR. The RevOps Command
> Center reads every sales call, scores it against MEDDPICC, updates the CRM, and
> alerts the manager in Slack — automatically, before the rep is even back at their
> desk. No human in the loop."

**The transformation, in one line:** *gaps surface weeks later at the QBR → gaps surface in Slack minutes after the call.*

---

## Your slot: 15 min, audience = accelerator peers + instructor

They're **technical** and building similar capstones, so lean into the *engineering
decisions* — that's what peers relate to and what the instructor grades. Budget ~13 min
presenting + ~2 min Q&A. Detailed talking points for each beat are in "The run-through" below.

| Time | Beat | On screen | Thrust |
|---|---|---|---|
| 0:00–1:00 | **Hook** | you | The QBR-surprise pain + the one-line pitch |
| 1:00–2:30 | **Architecture** | README diagram | The pipeline in one breath: LLM-scored → DB → rules-flagged → HubSpot + Slack → self-scheduled |
| 2:30–5:00 | **Scoreboard** | terminal: `npm run process -- --all` | Lakeshore clean · Harbor 🔴 missing-EB · **Trellis 🔴 champion decline across 3 calls** (the human-misses moment) |
| 5:00–6:00 | **In the CRM** | HubSpot: Harbor note | The rep's view — the agent's MEDDPICC scorecard on the deal |
| 6:00–7:00 | **In Slack** | `#revops-command-center` | The manager's view — alerts + digest |
| 7:00–9:30 | **⭐ Live moment** | Slack | **Drag a transcript into the Slack channel** → the bot scores it, flags the risk, then asks to `Update`/`Create` the HubSpot deal → **you approve with one click** — live, no terminal |
| 9:30–10:30 | **Autonomy** | terminal: `systemctl list-timers` | It fires that same job every 15 min on its own |
| 10:30–13:00 | **Engineering rigor** | terminal / slide | Model benchmark, test suite 15/0, isolation, robustness (the graded stuff) |
| 13:00–13:30 | **Close** | you | Restate the transformation |
| 13:30–15:00 | **Q&A** | — | (bank at the bottom) |

**The one beat to expand for this audience is "Engineering rigor" (10:30–13:00)** — peers
and instructors reward *how* you built it, not just that it demos. Technical-depth bank:

- **Model choice was benchmarked, not assumed.** Ran Haiku 4.5, Sonnet 5, Opus 4.8 against a
  ground-truth answer key. Haiku was cheaper but systematically *under-scored risk* — it missed
  Harbor's missing economic buyer and NovaWorks' paper-process gap. Chose Sonnet 5: catches risk
  without crying wolf. *"I picked the model with data, not vibes."*
- **Tested against ground truth.** `npm test` = 15/0. Asserts score *bands* + exact flag behavior
  (not exact scores — LLM scoring varies run-to-run), and **false positives fail the suite** — a
  tool that flags healthy deals is as useless as one that misses dying ones.
- **Flag thresholds are calibrated to real scoring distributions.** e.g. a flag that sat right on
  the model's 3/4 scoring boundary was flip-flopping run-to-run; widened the threshold with margin
  so it's stable. *This is the kind of detail that shows you actually ran it, repeatedly.*
- **Robust to LLM output quirks.** Strips raw control chars before JSON.parse, retries once on
  transient parse errors, generous `max_tokens` so adaptive-thinking output doesn't truncate.
- **Isolated + idempotent.** Runs as its own service with its own credentials, fully separate from
  the other agent on the box; transcripts are keyed by filename so re-runs never double-process.

---

## Before you present — checklist

Run these ~5 minutes before you're up:

- [ ] **Screen layout:** three things visible/tabbed — the **Slack `#revops-command-center`** channel, **HubSpot deals** list, and a **terminal** in `~/revops-command-center`.
- [ ] **Turn autonomy ON for the demo** (so the "it runs itself" beat is true and `list-timers`
      shows it): `systemctl enable --now revops-poll.timer revops-digest.timer`. An idle poll firing
      mid-demo is harmless (silent — nothing new to score), and the live moment uses the Slack
      listener, not the timer. Turn it back off after (see "After the demo").
- [ ] **Refresh to a clean state** so Slack/HubSpot show current scores:
      `npm run process -- --all --push-hubspot --notify-slack`
      *(this reposts a fresh digest — do it early so the channel looks current)*
- [ ] **Start the Slack listener** (this powers the live drag-and-drop). In a spare terminal, run
      `npm run listen` and leave it running — wait for `⚡ … running (Socket Mode)`. Stop it after
      the demo with Ctrl+C.
- [ ] **Have a transcript file on your laptop to drop into Slack.** The three staged at-risk ones
      live server-side in `demo/incoming/` (`cobalt_systems.txt`, `meridian_freight.txt`,
      `northstar_capital.txt`) — download one to your laptop beforehand (or keep your own handy).
      They're out of `transcripts/`, so the canonical pipeline stays the six story deals.
- [ ] **Backup proof ready:** a browser tab with the HubSpot notes + a terminal ready to run `npm test`, in case live API is slow.

---

## Driving it live (operator mechanics)

The system runs on the **server** (`heather-dev`), not your laptop. You present from your
laptop, screen-sharing, and drive the server through an **SSH terminal** while showing results
in two **browser tabs**. You're just flipping between a terminal and two tabs.

**Open before you present:**
1. **Terminal SSH'd into the server**, in the project dir — PowerShell `ssh heather-dev` then
   `cd ~/revops-command-center` (or VS Code's integrated terminal on heather-dev). **Big font**
   (Ctrl+`+`) so the room can read it.
2. **Browser tab — Slack** → `#revops-command-center`
3. **Browser tab — HubSpot** → Deals list
4. **Share your whole screen** (not one window) so you can flip between them.

**Where each beat happens:**
| Beat | Window | You do |
|---|---|---|
| Scoreboard | Terminal | `npm run process -- --all` → talk over the table |
| In the CRM | HubSpot tab | Open **Harbor Health** → Notes |
| In Slack | Slack tab | Scroll the channel |
| ⭐ Live moment | **Slack tab** | **Drag the transcript file into the channel** and send — the bot replies with the scorecard, then approval buttons; **click `Update`/`Create`** to write to HubSpot. No terminal. |
| Autonomy | Terminal | `systemctl list-timers 'revops-*'` |

Note: the Slack listener (`npm run listen`) runs in its own terminal, started before the demo — you
don't touch it during. So during the demo you're mostly in Slack + HubSpot, dipping into the terminal
only for the scoreboard and autonomy beats.

**Operator tips:** connect the SSH session *before* you start (don't log in on stage); keep every
command in `demo/COMMANDS.md` and **paste, don't type**; run the clean-state refresh ~5 min early;
if wifi dies, your SSH drops — walk the pre-refreshed Slack + HubSpot tabs instead (the story's
already there).

---

## The run-through

### Beat 0 — The hook (30s) [CORE]
Say the pitch above. Land the pain: *"By the time the gap shows up at the quarterly
review, the deal's already cold. What if the system caught it the moment the call ended?"*

### Beat 1 — What it is (45s) [IF TIME]
One breath of architecture (point at the README diagram):
> "Transcript comes in → an LLM scores it on the eight MEDDPICC elements → results
> land in a database → a rules engine raises risk flags → it writes a note back to
> HubSpot and posts to Slack. And it runs itself on a schedule."

### Beat 2 — The scoreboard (90s) [CORE]
In the terminal:
```bash
npm run process -- --all
```
While it runs, narrate. When the table prints, walk **three** deals (don't read all six):
- **Lakeshore Fintech — ✓ clean.** *"A healthy deal. The system stays quiet. This
  matters as much as catching bad deals — a tool that cries wolf gets ignored."*
- **Harbor Health — 🔴 NO_EB_LATE_STAGE.** *"At the proposal stage with no economic
  buyer engaged. The champion keeps deflecting the CFO. That's a deal that stalls."*
- **Trellis Logistics — 🔴 CHAMPION_DECLINE.** *"This is the one a human misses. Across
  three calls, the champion's engagement drops — 8, then 6, then 4. No single call
  looks alarming; the trend is. The system watches the trajectory."*

### Beat 3 — In the CRM (60s) [CORE]
Switch to HubSpot → open **Harbor Health Systems** → **Notes**.
> "This is what the rep sees when they open the deal — the agent's MEDDPICC scorecard
> and exactly why it's flagged. The agent wrote this itself."

### Beat 4 — In Slack (60s) [CORE]
Switch to **`#revops-command-center`**.
> "And the manager gets this — a red alert the moment a deal goes critical, plus a
> Monday digest of the whole pipeline. Harbor's missing economic buyer is right here,
> weeks before it would've surfaced at the QBR."

### Beat 5 — THE LIVE MOMENT (2 min) [CORE — this is the wow]
> "Let me show you it's real, right here in Slack. A rep just finished a call — I'll drop
> the transcript straight into the channel."

**Drag the transcript file into `#revops-command-center`** (from your laptop) and send it.
Narrate while it scores (~15s): *"No terminal, no dashboard — I just dropped a call into Slack.
The bot is scoring all eight MEDDPICC elements and checking HubSpot for a matching deal…"*
The bot replies **in the channel**: 📥 *Got it — scoring…* → a **scorecard with the 🔴 red flag**
→ then an **approval prompt** with buttons: *found a match — `Update` this deal, or `Create` a new one?*
> "And here's the part that matters when something writes to your CRM: it does **not** act on its
> own. It found the existing deal and it's asking me before it touches it — deal data is too
> critical to let an agent write blind. That's the human in the loop."

**Click `Update`** (or `Create` for a net-new deal). The message rewrites in place:
✅ *Updated existing deal and wrote the MEDDPICC note to HubSpot (approved by …)*.
> "That's the whole thesis — the real product experience. A rep drops the call into Slack; the
> agent scores it, flags the risk, and *proposes* the CRM update — a human approves with one
> click, and it's done, before they're back at their desk. No duplicate deals, no blind writes."

*Fallback if the drag/listener misbehaves:* run it from the terminal instead —
`npm run process -- --only <name> --push-hubspot --notify-slack` (the CLI path writes directly,
without the approval gate) — then switch to Slack.

### Beat 6 — And it runs itself (45s) [CORE]
```bash
systemctl list-timers 'revops-*'
```
> "That live run wasn't me — it's the same job that fires every 15 minutes on its own.
> There's no dashboard someone has to remember to check. It just works while everyone sleeps."
*(Optional: `journalctl -u revops-poll -n 5` to show it logging itself.)*

### Beat 7 — Why you can trust it (60s) [IF TIME]
Three credibility points:
- **It's tested.** `npm test` → 15/0 against a ground-truth answer key. Flags must fire
  correctly *and* healthy deals must stay clean — false positives fail the suite.
- **Model choice was earned, not assumed.** *"I benchmarked three models against the
  answer key. Haiku was cheaper but systematically under-scored risk — it missed
  Harbor's missing buyer. So it runs on Sonnet. That's a data-driven decision, not a guess."*
- **It's isolated.** Runs as its own service with its own credentials, separate from
  everything else on the box.

### Beat 8 — Close (30s) [CORE]
> "So that's the RevOps Command Center. It turns every sales call into a scored,
> flagged, CRM-updated, manager-alerted event — automatically. The reps keep selling;
> the system watches every deal for the gaps that kill them."

---

## The live moment — exact mechanics & safety

- **Primary path (Slack drag-and-drop):** with `npm run listen` running, drag a transcript file
  from your laptop into `#revops-command-center`. The bot saves it, scores it, replies with the
  scorecard, then **asks before writing to HubSpot** — it fuzzy-matches the deal name and posts
  `Update` / `Create` / `Skip` buttons. Nothing hits the CRM until you click. That's it — no terminal.
- **Two clicks to rehearse the gate:** drop a transcript whose deal exists in the portal (e.g. a
  Harbor Health call → `Update: Harbor Health Systems`), and one with a new name → `Create`. The
  approval message rewrites in place to the outcome and records who approved.
- **Have the file on your laptop.** The staged transcripts live server-side in `demo/incoming/`;
  download one (or use your own). Each drop needs a **fresh deal name** — re-dropping the same
  filename is skipped as already-processed (the bot will say it couldn't score it). Use a different
  staged file each rehearsal, or reset (below).
- **Terminal fallback** (if the drag/listener misbehaves):
  ```bash
  cp demo/incoming/cobalt_systems.txt transcripts/ && systemctl start revops-poll.service
  # (or without systemd:)  npm run process -- --only cobalt --push-hubspot --notify-slack
  ```
- **Reset a deal between rehearsals** (so you can re-drop the same one):
  ```bash
  node --input-type=module -e "import { supabase } from './src/db.js'; const r = await supabase.from('deals').select('id').eq('name','Cobalt Systems').maybeSingle(); if (r.data) { await supabase.from('deals').delete().eq('id', r.data.id); console.log('reset'); }"
  rm -f transcripts/cobalt_systems.txt
  ```
  *(Simplest: rotate through the three staged transcripts — cobalt / meridian / northstar — one per run.)*

## Revenue co-pilot capabilities (new — beyond scoring)

The system now closes the loop, not just observes it. Four commands, all reading the
scores already in Supabase:

- **Gap-closed loop (the wow beat #2):** when a previously-flagged gap recovers on a
  later call, the system announces it. Live moment: Harbor is on the board at-risk
  (missing economic buyer). Drop `demo/incoming/02d_harbor_health_eb_secured.txt` —
  the CFO finally engaged on that call — and the scorecard reply shows
  `✅ Closed since last call: economic-buyer gap (economic_buyer 3 → 10)`. It proves
  the loop, not just the alert.
- **Follow-up drafter:** `npm run followup -- --deal "Harbor Health" [--slack]` drafts a
  sendable email that closes the deal's biggest gap, grounded in the call evidence.
- **Risk-adjusted forecast:** `npm run forecast [--slack]` — committed pipeline vs. what's
  actually de-risked. The one-liner for leadership: "$525K committed, $235K risk-adjusted —
  half your pipeline is hope." Amounts seed from `data/deal-amounts.json`.
- **Ask-the-pipeline:** `npm run ask "which proposal-stage deals have no economic buyer?"` —
  natural-language questions answered from the live scores, with citations.

## Fallback plan (if live API is slow or the wifi dies)
- You've already refreshed state in the checklist, so **Slack + HubSpot already show
  the full story** — walk those instead of running live.
- Show `npm test` output (or a screenshot) as proof the pipeline works.
- Have a screen recording of one successful live run as the ultimate backup.

## Anticipated Q&A
- **"Does the LLM hallucinate scores?"** — Scoring is evidence-based (the prompt demands
  justification from the transcript) and validated against a ground-truth answer key in
  the test suite. A human can still review; nothing auto-closes a deal.
- **"What does it cost?"** — Pennies per full run. I benchmarked models on cost *and*
  accuracy and chose the tier that catches risk reliably.
- **"Why not just a HubSpot workflow?"** — Workflows can't read an unstructured sales call
  and reason about MEDDPICC nuance (a champion deflecting the CFO, a trend across calls).
  That's the LLM's job; HubSpot is where the output lands.
- **"How do you avoid false alarms?"** — By design: the healthy control deal stays clean,
  and the test suite fails on any false positive. The false-positive guard is strict for
  healthy deals specifically.
- **"Does it scale?"** — The pipeline is stateless and idempotent; state lives in Supabase.
  More deals = more scheduled runs, nothing structural changes.

---

## After the demo
- Stop the Slack listener: **Ctrl+C** in its terminal.
- Turn autonomy back off (keeps costs at zero between demos):
  ```bash
  systemctl disable --now revops-poll.timer revops-digest.timer
  ```
