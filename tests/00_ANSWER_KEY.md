# ShieldPoint Demo Pipeline — Answer Key

Fictional vendor: **ShieldPoint** — B2B SaaS cloud security posture management (CSPM) + threat detection platform. Mid-market/enterprise sales motion. Reps: Dana Whitfield, Marcus Cole.

This file documents the planted MEDDPICC characteristics per deal so you can validate the Command Center's scoring and flagging against known ground truth. Do not feed this file to the agent.

---

## Deal 1: Lakeshore Fintech — HEALTHY (control deal)
Calls: 01a, 01b
- Metrics: STRONG — quantified audit remediation costs ($340K last year), 14-day mean time to remediate misconfigs
- Economic Buyer: STRONG — CISO (Priya Raman) joins call 2, confirms budget
- Decision Criteria: STRONG — defined in call 2 (multi-cloud coverage, SOC 2 evidence automation, deployment < 30 days)
- Decision Process: STRONG — security review → legal → CFO sign-off, mapped in call 2
- Paper Process: STRONG — MSA redlines discussed, procurement contact named
- Identify Pain: STRONG — failed audit finding, PCI deadline Oct 1
- Champion: STRONG — VP Security Ops (Tom Okafor) actively selling internally
- Competition: KNOWN — incumbent manual process, no active competitor
- Expected system behavior: high score, no flags, green in digest

## Deal 2: Harbor Health Systems — MISSING ECONOMIC BUYER
Calls: 02a, 02b
- Champion (Security Manager, Leah Brandt) is enthusiastic but repeatedly deflects EB involvement ("I'll socialize it with Rick myself")
- Deal advances to stage 3 (proposal discussed in call 2) with EB never on a call
- Expected system behavior: rules-engine flag — "No Economic Buyer contact past stage 3"

## Deal 3: Trellis Logistics — CHAMPION DETERIORATION (trend detection)
Calls: 03a, 03b, 03c
- Call 1: champion (Dir. of Infrastructure, Sam Reyes) highly engaged, sets next steps proactively
- Call 2: delayed follow-ups, "priorities are shifting a bit," shorter answers
- Call 3: champion passive, defers to skeptical new stakeholder (IT Ops lead), no next step committed
- Expected system behavior: Champion score declines across 3 calls → trend alert

## Deal 4: Bluepine Retail — VAGUE PAIN / NO METRICS
Calls: 04a
- Interest is real but exploratory; prospect can't quantify cost of current gaps; "just seeing what's out there"
- Expected system behavior: low Metrics + Identify Pain scores, digest marks as early/unqualified

## Deal 5: NovaWorks — NO PAPER PROCESS AT LATE STAGE
Calls: 05a
- Verbal enthusiasm, "let's move forward this quarter," but legal, procurement, and security review never discussed; rep doesn't probe
- Expected system behavior: flag — late-stage deal with Decision Process / Paper Process unknown; slip risk

## Deal 6: Corvid Manufacturing — COMPETITIVE THREAT, NO DECISION CRITERIA
Calls: 06a
- Competitor "Clearmont" already in evaluation; prospect hasn't defined criteria; ShieldPoint reacting, not shaping
- Expected system behavior: Competition flagged, Decision Criteria weak, alert to establish criteria before demo

---

## Suggested demo beats
1. Ingest all 10 calls → pipeline populates in Supabase + HubSpot
2. Show Lakeshore scoring green (proves it doesn't cry wolf)
3. Show Harbor EB flag firing in Slack
4. Show Trellis trend line declining across 3 calls — the "this is what a human reviewer misses" moment
5. Monday digest summarizing all 6 deals
