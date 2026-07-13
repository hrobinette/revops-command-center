# RevOps Command Center — Recorded Video Script

**Target length:** 6–8 minutes (requirement is 5–10).
**Audience:** a non-technical executive. No AI jargon. Lead with the business problem.
**Format:** Descript, face in frame throughout. `[CAM]` = talking head. `[SCREEN]` = screen-share B-roll over your voice.
**Covers the four required points:** problem/opportunity · what you built · technical approach · value.

Speak it conversationally — these are talking points, not a teleprompter. Times are cumulative targets.

---

## 1 · The problem (0:00 – 1:15) `[CAM]`

> "Every sales team runs on a forecast. The VP looks at the pipeline, sees a number, and tells the board what's going to close. Here's the uncomfortable truth: a lot of that number is hope.
>
> A rep has a great call, feels good, marks the deal 'on track.' But the deal has a hole in it — nobody ever met the person who controls the budget. And nobody notices, because the rep is optimistic and busy, and the CRM only says what the rep types into it.
>
> So the gap sits there. It surfaces weeks later, at the quarterly review, when it's too late to fix. The deal slips, or dies. Multiply that across a whole team and the forecast isn't a forecast — it's a wish list."

*(Optional, if you want a number: "Sales teams use a framework called MEDDPICC — eight things that have to be true for a deal to be real. The problem was never the framework. It's that nobody has time to check all eight, on every call, for every deal.")*

## 2 · The opportunity (1:15 – 2:00) `[CAM]`

> "So I asked a simple question. What if every sales call scored itself the moment it ended? What if, before the rep is even back at their desk, the deal is scored against all eight criteria, the CRM is updated, the manager already knows about the missing budget holder, and the rep has a suggested next step waiting?
>
> Not a report someone has to run. Not a dashboard someone has to remember to check. A system that just does the job, in the background, on every call. That's what I built. It's called the RevOps Command Center."

## 3 · What I built — the loop (2:00 – 4:00) `[SCREEN: dashboard, then Slack]`

> "Here's the whole thing in one breath. A sales call transcript comes in. The system reads it and scores the deal against all eight criteria — with evidence, quoting what was actually said. It spots the risks: a deal in late stage that still has no budget holder, a champion who's going quiet. It updates the CRM. It alerts the manager in Slack. And it does all of this on its own."

`[SCREEN: the live dashboard]`
> "This is the live view. Every deal, color-coded by health. Red means a real problem. This one — Harbor Health — is flagged because it's deep in the process but nobody's engaged the budget holder. The system caught that automatically, from the call."

`[SCREEN: drag a transcript into Slack, bot replies]`
> "And here's what it feels like in practice. A rep finishes a call and drops the transcript into Slack. Watch. The system scores it live, right here in the channel — no terminal, no forms. Eight scores, and the risk flag, in seconds."

## 4 · What makes it different — the value (4:00 – 6:15) `[SCREEN as noted]`

> "Four things make this more than a scorecard.

**One — it asks before it touches your CRM.** `[SCREEN: the Update/Create approval buttons in Slack]`
> "Deal data is too important to let software change it blind. So when the system wants to update the CRM, it asks. A human clicks approve. You get the speed of automation with the safety of a person in the loop."

**Two — it proves the gap closed.** `[SCREEN: drop the follow-up call, "closed its gap" reply]`
> "This is the part I'm proudest of. It doesn't just raise an alarm. When the next call comes in and that missing budget holder finally shows up, the system says so: 'Harbor closed its economic-buyer gap.' It closes the loop. You can see the risk being retired, not just reported."

**Three — a forecast you can actually trust.** `[SCREEN: the forecast band on the dashboard]`
> "This is the number a VP cares about. On paper this pipeline is 525,000 dollars committed. Weighted by how real each deal actually is, it's 235,000. That 55% gap is the hope I mentioned at the start — and now it's a number on a screen instead of a surprise at the review."

**Four — it drafts the next move.** `[SCREEN optional: followup output]`
> "And it doesn't stop at 'here's the problem.' It drafts the follow-up email to fix it — the one that gets the budget holder on the next call. The rep edits and sends. It turns insight into action."

## 5 · How it works, briefly (6:15 – 7:30) `[CAM, optional SCREEN]`

> "A word on how, kept simple. The judgment — reading the call, scoring it, spotting the risk — is done by Claude, Anthropic's AI model. Everything around it is plumbing: it stores the history, connects to the CRM and to Slack, and runs itself on a schedule.
>
> Two things I want to call out, because they're what make it trustworthy. First, it's tested against an answer key — I graded its scoring the way you'd grade a person, and it has to pass. Second, the model choice wasn't a guess. I tried a cheaper model and it consistently under-rated risk — it missed the very gaps that matter. So it runs on the stronger one. That's a deliberate, measured decision, not a default."

## 6 · The value, and close (7:30 – 8:00) `[CAM]`

> "So here's what changes. Every sales call becomes a scored, flagged, CRM-updated, manager-alerted event — automatically, with a person approving anything that matters. The manager stops finding out about dead deals at the quarterly review. The forecast reflects reality. And the reps just keep selling.
>
> That's the RevOps Command Center. Thanks for watching."

---

### Recording notes
- **Trim ruthlessly.** If you run long, cut section 5 down to two sentences — the value beats (section 4) matter more than the plumbing.
- **The two money shots** are the gap-closed "closed its gap" moment and the forecast band ($525K → $235K). Make sure both are on screen and legible.
- Pre-stage the dashboard and Slack tabs so the B-roll is instant. Run `npm run preflight` first so nothing fails mid-record.
- Say "budget holder" not "economic buyer," "sales process" not "MEDDPICC," unless you define the term once. Exec-friendly.
