# Demo Command Cheat-Sheet — paste in order

Every command runs in a terminal **SSH'd into `heather-dev`**, in `~/revops-command-center`.
Keep this open in a scratch window and **paste line by line** — no live typing.

```bash
# ─────────────────────────────────────────────────────────────
# ~5 MIN BEFORE YOU PRESENT  (setup — do these off-stage)
# ─────────────────────────────────────────────────────────────
cd ~/revops-command-center
systemctl stop revops-poll.timer                          # pause auto-timer during the demo
npm run process -- --all --push-hubspot --notify-slack    # refresh clean state (reposts digest)


# ─────────────────────────────────────────────────────────────
# BEAT 2 — THE SCOREBOARD  (terminal)
# ─────────────────────────────────────────────────────────────
npm run process -- --all
#   → walk Lakeshore (clean) · Harbor (🔴 EB) · Trellis (🔴 champion decline)


# ─────────────────────────────────────────────────────────────
# BEAT 5 — THE LIVE MOMENT ⭐  (terminal, then switch to Slack tab)
# ─────────────────────────────────────────────────────────────
cp demo/incoming/cobalt_systems.txt transcripts/
systemctl start revops-poll.service
#   → NOW switch to the Slack tab and wait ~15s for the Cobalt 🔴 alert to appear


# ─────────────────────────────────────────────────────────────
# BEAT 6 — AUTONOMY  (terminal)
# ─────────────────────────────────────────────────────────────
systemctl list-timers 'revops-*'
journalctl -u revops-poll -n 5 --no-pager                 # optional: show it logging itself


# ─────────────────────────────────────────────────────────────
# AFTER THE DEMO  (cleanup + re-arm autonomy)
# ─────────────────────────────────────────────────────────────
systemctl start revops-poll.timer                         # re-enable the 15-min autonomous runs

# reset the Cobalt demo deal so you can re-rehearse it cleanly:
node --input-type=module -e "import { supabase } from './src/db.js'; const r = await supabase.from('deals').select('id').eq('name','Cobalt Systems').maybeSingle(); if (r.data) { await supabase.from('deals').delete().eq('id', r.data.id); console.log('reset Cobalt'); } else console.log('no Cobalt row'); "
rm -f transcripts/cobalt_systems.txt
```

## Fallback (if wifi/API dies mid-demo)
You already ran the clean-state refresh, so **Slack + HubSpot already show the whole story** —
just walk those two tabs and narrate. Optionally show a screenshot of `npm test` (15/0) as proof.

## Backup live transcript
If you want to run the live moment twice (or Cobalt got used), the second staged transcript is
`demo/incoming/meridian_freight.txt` — same drop command, swap the filename:
```bash
cp demo/incoming/meridian_freight.txt transcripts/
systemctl start revops-poll.service
```
