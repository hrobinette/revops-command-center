# RevOps Command Center — Project Brief

## What this is

An autonomous revenue operations agent built as the capstone for the Overclock AI Ops Accelerator. It monitors sales call transcripts for a fictional B2B SaaS company (**ShieldPoint**, cloud security posture management), scores every deal against MEDDPICC, maintains CRM state, detects at-risk deals, and reports to Slack — with no human in the loop.

This is not a tool a person uses. It is a scheduled process that does a job. The demo contrast: previously a rep finishes a call and gaps surface at the QBR weeks later; with this system, by the time the rep is back at their desk, the deal is scored, the CRM is updated, and the manager already knows about the missing Economic Buyer.

## Architecture

```
[Transcript source]          Week 7: local files in ./transcripts/
                             Week 8+: polled from meeting tool
        │
        ▼
[Ingestion] ── detects unprocessed transcripts, parses metadata header
        │
        ▼
[MEDDPICC scoring engine] ── Anthropic API call per transcript
        │                    (prompts ported from the MEDDPICC Analyzer project)
        ▼
[State layer: Supabase] ── deals, calls, scores over time
        │
        ├──▶ [Risk engine] ── rules + LLM judgment, produces flags
        │
        ├──▶ [CRM sync: HubSpot] ── Week 8
        │
        └──▶ [Slack delivery] ── Week 8: alerts + Monday digest
```

Runtime: Node.js, plain scripts (no web framework needed). Runs on a schedule via cron/systemd timer in production; during development, invoked manually (`npm run process`).

## Build phases

**Week 7 (current scope — build only this):**
1. Project scaffold: git repo, `.gitignore` including `.env` committed before anything else, `.env` with placeholders, README
2. Supabase schema (below), applied via SQL migration file checked into the repo
3. Ingestion: read `./transcripts/*.txt`, parse the metadata header (Deal, Call, Date, Attendees), skip already-processed files (track by filename in DB)
4. Scoring engine: one Anthropic API call per transcript returning structured JSON (schema below); store in Supabase
5. Trend computation: for deals with multiple calls, compute per-element score deltas across calls
6. Rules-based flags (below) written to a `flags` table
7. CLI output: `npm run process` prints a summary table of deals, scores, and fired flags
8. Test harness: `npm test` runs all 10 sample transcripts and validates system behavior against `tests/expectations.json` (derived from the answer key)

**Week 8 (do not build yet):** HubSpot sync via Service Key, Slack alerts + weekly digest, scheduled autonomous runs.

**Week 9 (do not build yet):** polish, demo seeding, trend visualizations.

## Data model (Supabase / Postgres)

```sql
create table deals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- e.g. "Lakeshore Fintech"
  company text not null,
  stage text,                          -- discovery | evaluation | proposal | negotiation
  hubspot_deal_id text,                -- null until Week 8
  created_at timestamptz default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id),
  source_file text unique not null,    -- idempotency key
  call_number int,
  call_date date,
  attendees text[],
  transcript text,
  processed_at timestamptz default now()
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls(id),
  deal_id uuid references deals(id),
  element text not null,               -- one of the 8 MEDDPICC elements
  score int not null,                  -- 0–10
  confidence text not null,            -- high | medium | low
  evidence text,                       -- brief justification, no long quotes
  created_at timestamptz default now()
);

create table flags (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id),
  call_id uuid references calls(id),
  flag_type text not null,             -- see rules below
  severity text not null,              -- red | yellow
  detail text,
  created_at timestamptz default now()
);
```

## MEDDPICC scoring spec

Eight elements, each scored 0–10 per call: Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition.

The API call must return strict JSON (no prose, no markdown fences):

```json
{
  "deal_name": "...",
  "stage_assessment": "discovery|evaluation|proposal|negotiation",
  "elements": [
    {
      "element": "economic_buyer",
      "score": 3,
      "confidence": "high",
      "evidence": "Champion explicitly deflecting CISO involvement; EB has seen nothing"
    }
  ],
  "summary": "2-3 sentence deal health assessment"
}
```

Scoring anchors: 0–2 = not identified/absent, 3–5 = mentioned but unvalidated, 6–8 = identified and engaged, 9–10 = confirmed and documented. The prompt should demand evidence-based scoring — every score justified by what is actually in the transcript, not inferred generously. Reuse and adapt the validated prompts from the MEDDPICC Analyzer project where possible.

## Risk rules (Week 7: compute and store; Week 8: alert)

1. `NO_EB_LATE_STAGE` (red): deal at proposal or later AND economic_buyer score < 5 on latest call
2. `CHAMPION_DECLINE` (red): champion score decreased on 2+ consecutive calls
3. `NO_PAPER_PROCESS_LATE` (yellow): proposal or later AND paper_process score < 4
4. `UNQUALIFIED` (yellow): metrics AND identify_pain both < 4 on latest call
5. `COMPETITIVE_EXPOSURE` (yellow): competition mentions a named competitor AND decision_criteria score < 5

## Test suite

`./transcripts/` contains 10 engineered transcripts across 6 deals. `tests/expectations.json` encodes the expected behavior per deal (derived from the answer key — see 00_ANSWER_KEY.md, which must NOT be included in any prompt sent to the scoring engine):

| Deal | Calls | Expected outcome |
|---|---|---|
| Lakeshore Fintech | 2 | High scores, zero flags |
| Harbor Health | 2 | NO_EB_LATE_STAGE fires |
| Trellis Logistics | 3 | CHAMPION_DECLINE fires (scores drop across calls 1→2→3) |
| Bluepine Retail | 1 | UNQUALIFIED fires |
| NovaWorks | 1 | NO_PAPER_PROCESS_LATE fires |
| Corvid Manufacturing | 1 | COMPETITIVE_EXPOSURE fires |

Test tolerance: exact scores will vary run to run; tests assert score *bands* (e.g. Lakeshore economic_buyer ≥ 7, Harbor economic_buyer ≤ 5 on call 2) and exact flag behavior (which flags fire, which don't). A test run that fires a flag not in the expectations for that deal is a failure — false positives matter as much as misses.

## Security and hygiene rules

- All credentials live in `.env` only: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `HUBSPOT_TOKEN` (unused until Week 8)
- `.env` is gitignored from the first commit; never print, log, or echo credential values
- This project must stay fully isolated from the Nox agent running on the same machine: separate directory, separate `.env`, separate Slack identity (Week 8). Never read from or write to Nox's directories or environment.
- HubSpot target is a disposable developer test portal, never a production or personal portal
- Small, frequent commits with clear messages

## Conventions

- Node.js, ES modules, no framework
- `npm run process` — run the pipeline on unprocessed transcripts
- `npm run process -- --all` — reprocess everything (clears and rebuilds scores)
- `npm test` — full test suite against expectations
- Keep the scoring prompt in a dedicated file (`src/prompts/meddpicc.js`) so it can be tuned without touching pipeline code
- Console output should be demo-friendly: clean tables, clear flag callouts, no debug noise by default
