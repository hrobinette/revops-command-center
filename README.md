# RevOps Command Center

Autonomous revenue-operations agent — capstone for the Overclock AI Ops Accelerator.
It scores sales-call transcripts against **MEDDPICC**, tracks how each deal trends
across calls, and raises risk flags — no human in the loop. Full spec in
[`CLAUDE.md`](./CLAUDE.md).

This is **Week 7 scope**: the core loop only.
`transcript → MEDDPICC score → Supabase → trends → risk flags → summary table`.
HubSpot sync and Slack delivery are Week 8 and are intentionally **not** built yet.

## Pipeline

```
transcripts/*.txt ─▶ ingest ─▶ Anthropic scoring ─▶ Supabase ─▶ trends ─▶ flags ─▶ CLI table
```

| Module | Responsibility |
|---|---|
| `src/ingest.js` | Read `transcripts/*.txt`, parse the metadata header + body |
| `src/prompts/meddpicc.js` | The scoring prompt (tune here, not in pipeline code) |
| `src/score.js` | One Anthropic call per transcript → validated JSON |
| `src/db.js` | Supabase state layer (deals, calls, scores, flags) |
| `src/trends.js` | Per-element score series + deltas across a deal's calls |
| `src/flags.js` | The five risk rules |
| `src/process.js` | Orchestration + CLI + summary table |
| `tests/run.js` | Reprocess all transcripts, assert bands + flag behavior |

## Setup

1. **Install deps:** `npm install`
2. **Fill `.env`** (copy from `.env.example`) — real values in a text editor, never through a chat:
   - `ANTHROPIC_API_KEY`, `MEDDPICC_MODEL` (default `claude-sonnet-5`)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `HUBSPOT_TOKEN` — leave as placeholder (Week 8)
3. **Apply the schema:** paste `migrations/001_init.sql` into the Supabase SQL editor and run it.
4. **Add data:** drop the 10 `.txt` transcripts into `transcripts/` (header format in
   [`transcripts/README.md`](./transcripts/README.md)) and the answer key at `tests/00_ANSWER_KEY.md`.

## Usage

```bash
npm run process                 # process new (unprocessed) transcripts
npm run process -- --all        # wipe + reprocess everything
npm run process -- --only lakeshore   # single-deal checkpoint run
npm run process -- --limit 1    # process just the first transcript, end to end
npm run process -- --all --push-hubspot   # also upsert deals + write MEDDPICC notes to HubSpot
npm run process -- --all --notify-slack   # also post red-flag alerts + a health digest to Slack
npm test                        # full suite vs tests/expectations.json
```

## Scheduling (autonomous runs)

Two systemd timers make it hands-off — unit files in `deploy/systemd/`:

- **Poll** (`revops-poll.timer`, every 15 min) → `bin/scheduled-run.sh`: processes any
  *new* transcripts and syncs to HubSpot + Slack. Idle-safe — silent when nothing's new.
- **Monday digest** (`revops-digest.timer`, Mon 13:00 UTC ≈ 9am ET) → `bin/post-digest.sh`:
  posts a full deal-health digest to Slack.

Install once (root):

```bash
cp deploy/systemd/revops-*.service deploy/systemd/revops-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now revops-poll.timer revops-digest.timer
systemctl list-timers 'revops-*'          # confirm they're scheduled
```

Logs: `journalctl -u revops-poll` / `-u revops-digest`, plus `logs/scheduled.log`.
Disable: `systemctl disable --now revops-poll.timer revops-digest.timer`.

## Risk flags

| Flag | Severity | Fires when |
|---|---|---|
| `NO_EB_LATE_STAGE` | 🔴 red | proposal+ and economic_buyer < 5 (latest call) |
| `CHAMPION_DECLINE` | 🔴 red | champion score falls on 2+ consecutive calls |
| `NO_PAPER_PROCESS_LATE` | 🟡 yellow | proposal+ and paper_process < 5 (not yet engaged) |
| `UNQUALIFIED` | 🟡 yellow | metrics < 4 **and** identify_pain < 4 (latest call) |
| `COMPETITIVE_EXPOSURE` | 🟡 yellow | a named competitor **and** decision_criteria < 5 |

## Isolation

This project shares hardware with the Nox agent but nothing else: its own directory,
its own `.env`, and (Week 8) its own Slack identity. It never reads from or writes to
Nox's directories or environment. The HubSpot target is a disposable developer test portal.
