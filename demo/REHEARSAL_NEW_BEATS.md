# Rehearsal Runbook — the two new beats

Slots into the existing `DEMO.md` flow. Covers the **risk-adjusted forecast** and the
**gap-closed loop** — the two capabilities added after the original runbook. Copy-paste
commands; every one is safe to run from `~/revops-command-center`.

---

## Before you start (2 min)

```bash
npm run preflight        # all four services green, or fix before recording
```

Confirm the starting state is right — **Harbor must be on the board AT-RISK** (missing
economic buyer), because the whole gap-closed beat is about fixing it live:

```bash
npm run ask "is Harbor Health flagged, and what's its economic buyer score?"
```
You want to hear: flagged `NO_EB_LATE_STAGE`, economic_buyer around 3. If Harbor already
shows healthy, run the **Reset** block at the bottom first.

For the live drop, have the listener running in a spare terminal:
```bash
npm run listen           # wait for: ⚡ … running (Socket Mode)
```

---

## Beat A — The forecast a VP trusts (~90 sec)

**The line:** *"Scoring is nice, but here's the number a VP of Sales actually cares about."*

Show it one of two ways — pick the one that reads better on your screen:

**Option 1 — the dashboard** (already live, most visual):
Open https://revops-command-center-bay.vercel.app/ — point at the forecast band at the top.
> "On paper this pipeline is 525,000 dollars. Weighted by how real each deal actually is —
> is the budget holder engaged, is it trending up or stalling — it's 235,000. That 55% gap
> is the difference between the forecast and the truth. And every row shows its own
> risk-adjusted number and which way it's moving."

**Option 2 — the terminal** (punchier for a technical room):
```bash
npm run forecast
```
> "Committed pipeline, then risk-adjusted. Harbor's 85K collapses to 27K because the budget
> holder never showed. Trellis takes an extra hit because it's actively declining. The
> system isn't just scoring calls — it's re-pricing the pipeline."

**Fallback:** if the terminal is slow, the dashboard band is static and always there.

---

## Beat B — It proves the gap closed (~2.5 min) ⭐ the wow

This is the strongest new moment. Harbor is on the board at-risk. You're about to fix it live.

**Set it up (10 sec):**
> "Earlier you saw Harbor flagged red — deep in the deal, no budget holder. That's the alert.
> But an alert isn't the point. The point is closing the gap. Here's the very next call on
> that deal, where the CFO finally joined."

**Do it:** drag **`02d_harbor_health_eb_secured.txt`** (from `demo/incoming/`, have it on your
laptop) into the `#revops-command-center` Slack channel.

**What the audience sees (~15 sec of scoring), narrate it:**
> "It's scoring the call live… and there it is."

The bot replies with the scorecard, now clean, plus the line that matters:
> **✅ Closed since last call: economic-buyer gap (economic_buyer 3 → 10), paper-process gap**

**Land it:**
> "That's the whole thesis. It didn't just flag the risk — it watched the next call and
> confirmed the risk was retired. The loop is closed. A manager doesn't have to wonder
> whether the rep fixed it. The system already checked."

**Fallback (if the drag or listener misbehaves)** — run it from the terminal instead:
```bash
cp demo/incoming/02d_harbor_health_eb_secured.txt transcripts/
npm run process -- --only 02d_harbor --notify-slack
```
This scores the call and posts the "closed its gap" message to Slack the same way.

---

## Reset afterward (so it's repeatable) — 20 sec

Dropping 02d adds a recovery call to Harbor, which makes it healthy. To run the beat again
(or leave Harbor at-risk for the *other* demo beats), roll it back:

```bash
node --input-type=module -e "
import { supabase, getDealCallsWithScores, clearFlagsForDeal, insertFlags } from './src/db.js';
import { computeTrends } from './src/trends.js';
import { computeFlags } from './src/flags.js';
const { data: deal } = await supabase.from('deals').select('*').eq('name','Harbor Health Systems').single();
const { data: c } = await supabase.from('calls').select('id').eq('source_file','02d_harbor_health_eb_secured.txt').maybeSingle();
if (c) { await supabase.from('scores').delete().eq('call_id', c.id); await supabase.from('calls').delete().eq('id', c.id); }
const calls = await getDealCallsWithScores(deal.id);
const trends = computeTrends(calls);
const compRow = (trends.latestCall?.scores||[]).find(s=>s.element==='competition');
const flags = computeFlags(deal, trends, { modelStage: deal.stage, competition:{ named_competitor: Boolean(compRow?.named_competitor) }});
await clearFlagsForDeal(deal.id); await insertFlags(flags.map(f=>({...f, deal_id: deal.id})));
console.log('Harbor reset → at-risk again, latest EB', trends.latest.economic_buyer);
"
rm -f transcripts/02d_harbor_health_eb_secured.txt
```
You want to see `latest EB 3`. Now Harbor is back on the board red, ready for another run.

---

## Timing summary

| Beat | Time | The one line |
|------|------|--------------|
| Preflight + state check | (pre-show) | — |
| A · Risk-adjusted forecast | ~90s | "The number a VP actually trusts: 525K → 235K." |
| B · Gap-closed loop ⭐ | ~2.5m | "It didn't just flag the risk — it proved the gap closed." |
| Reset | ~20s | (off-camera, between takes) |

**If you only have time for one:** do Beat B. Proving the loop closed is the thing nobody
expects a scoring tool to do.
