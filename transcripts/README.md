# transcripts/

Drop the 10 engineered `.txt` transcripts here (6 deals). Each file must start with a
metadata header, then the conversation body. Two header styles are accepted; the parser
in `src/ingest.js` handles both.

**Preferred — a `---` fence between header and body:**

```
Deal: Lakeshore Fintech
Company: Lakeshore Fintech Inc.
Stage: proposal
Call: 2
Date: 2026-06-15
Attendees: Jamie Rivera (ShieldPoint AE), Dana Okafor (Lakeshore VP Eng)
---
Jamie: Thanks for making time again...
Dana: Of course. So since last call we...
```

**Fallback — the first blank line ends the header:**

```
Deal: Lakeshore Fintech
Company: Lakeshore Fintech Inc.
Stage: proposal
Call: 2
Date: 2026-06-15
Attendees: Jamie Rivera (ShieldPoint AE), Dana Okafor (Lakeshore VP Eng)

Jamie: Thanks for making time again...
```

Recognized header keys (case-insensitive): `Deal`, `Company`, `Stage`, `Call`, `Date`, `Attendees`.
- `Deal` is required (used to group calls into a deal).
- `Call` should be the call number (1, 2, 3…). If absent, the parser tries to read a trailing
  number from the filename (e.g. `trellis_call3.txt` → 3), else defaults to 1.
- `Attendees` is comma-separated.
- `Stage` drives the late-stage risk rules; if omitted, the model's `stage_assessment` is used.

> **Do not** put `00_ANSWER_KEY.md` in this folder or any file that would be read as a transcript.
> The answer key lives in `tests/` and must never be sent to the scoring engine.
