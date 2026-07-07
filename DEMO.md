# Demo Runbook — RevOps Command Center

## The pitch (memorize this)

> "Sales reps miss deal-killing gaps — a missing decision-maker, a champion going
> quiet — and nobody notices until the deal stalls at the QBR. The RevOps Command
> Center reads every sales call, scores it against MEDDPICC, updates the CRM, and
> alerts the manager in Slack — automatically, before the rep is even back at their
> desk. No human in the loop."

**The transformation, in one line:** *gaps surface weeks later at the QBR → gaps surface in Slack minutes after the call.*

---

## Format assumptions (adjust to taste)

Written for an **~8–12 min live demo** to a mixed technical/business audience.
Beats are tagged **[CORE]** (always do) and **[IF TIME]** (drop if short). A tight
5-min version = beats 0, 2, 5, 6, 8.

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
