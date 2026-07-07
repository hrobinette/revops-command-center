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
| 7:00–9:30 | **⭐ Live moment** | terminal → Slack | Drop Cobalt, trigger the poll, watch Slack light up hands-off |
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
- [ ] **Pause the auto-timer so it doesn't fire mid-demo** (you'll trigger runs on cue):
      `systemctl stop revops-poll.timer`  *(re-enable after: `systemctl start revops-poll.timer`)*
- [ ] **Refresh to a clean state** so Slack/HubSpot show current scores:
      `npm run process -- --all --push-hubspot --notify-slack`
      *(this reposts a fresh digest — do it early so the channel looks current)*
- [ ] **Stage the live transcript:** `demo/incoming/` holds two ready-to-drop at-risk
      transcripts — `cobalt_systems.txt` (fires 🔴 NO_EB_LATE_STAGE + competitive/paper/unqualified)
      and `meridian_freight.txt` (fires 🔴 NO_EB_LATE_STAGE). Use a fresh one per run.
      Neither is in `transcripts/`, so the canonical pipeline stays the six story deals.
      *(Note: an earlier test left a "Meridian Freight" deal in HubSpot — delete it there for a spotless CRM, or ignore it.)*
- [ ] **Backup proof ready:** a browser tab with the HubSpot notes + a terminal ready to run `npm test`, in case live API is slow.

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
> "Let me show you it's real. A rep just finished a call — here's the transcript."

Drop the new transcript and trigger the exact job the timer runs:
```bash
cp demo/incoming/cobalt_systems.txt transcripts/
systemctl start revops-poll.service        # identical to what fires every 15 min
```
Narrate while it scores (~10–15s): *"No human touched this. It's detecting the new
transcript, scoring it, updating HubSpot, posting to Slack…"*
Then **switch to Slack** — a fresh 🔴 alert for **Cobalt Systems** appears live.
> "That's the whole thesis: rep finishes the call, and before they're back at their
> desk, the deal's scored, the CRM's updated, and the manager already knows."

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

- **Stage a fresh transcript each run.** Processed files are skipped (idempotent), so for
  each rehearsal use a transcript with a **new deal name**, or reset (below).
- **Command recap:**
  ```bash
  cp demo/incoming/cobalt_systems.txt transcripts/     # drop the "new call"
  systemctl start revops-poll.service                  # what the timer runs
  # (or, without systemd:)  npm run process -- --push-hubspot --notify-slack
  ```
- **Reset between rehearsals** (so you can re-run the same deal): remove it from the DB.
  A throwaway one-liner:
  ```bash
  node -e "import('./src/db.js').then(async d=>{const {data}=await d.supabase.from('deals').select('id').eq('name','Cobalt Systems').maybeSingle().then(r=>r); if(data){await d.supabase.from('deals').delete().eq('id',data.id);} });" \
    ; rm -f transcripts/cobalt_systems.txt
  ```
  *(Or just keep 2–3 differently-named staged transcripts and use a fresh one each time.)*

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
Re-enable the autonomous timer if you paused it:
```bash
systemctl start revops-poll.timer
```
