# Demo Command Cheat-Sheet — paste in order

Commands run in a terminal **SSH'd into `heather-dev`**, in `~/revops-command-center`.
Keep this open in a scratch window and **paste line by line**. The ⭐ live moment needs NO command —
it's a drag-and-drop in Slack.

```bash
# ─────────────────────────────────────────────────────────────
# ~5 MIN BEFORE YOU PRESENT  (setup — off-stage)
# ─────────────────────────────────────────────────────────────
cd ~/revops-command-center
npm run process -- --all --push-hubspot --notify-slack    # refresh clean state (reposts digest)
systemctl enable --now revops-poll.timer revops-digest.timer   # autonomy ON for the demo (Beat 6)

# In a SEPARATE terminal (leave it running the whole demo — this powers the Slack drag-and-drop):
npm run listen                                            # wait for "⚡ … running (Socket Mode)"


# ─────────────────────────────────────────────────────────────
# BEAT 2 — THE SCOREBOARD  (terminal)
# ─────────────────────────────────────────────────────────────
npm run process -- --all
#   → walk Lakeshore (clean) · Harbor (🔴 EB) · Trellis (🔴 champion decline)


# ─────────────────────────────────────────────────────────────
# BEAT 5 — THE LIVE MOMENT ⭐  (ALL IN SLACK — NO COMMAND)
# ─────────────────────────────────────────────────────────────
#   → Drag a transcript file from your laptop into #revops-command-center and send it.
#   → The bot replies "📥 Got it — scoring…" then a scorecard with the 🔴 flag (~15s).
#
#   Terminal fallback ONLY if the drag/listener misbehaves:
#     cp demo/incoming/cobalt_systems.txt transcripts/ && systemctl start revops-poll.service


# ─────────────────────────────────────────────────────────────
# BEAT 6 — AUTONOMY  (terminal)
# ─────────────────────────────────────────────────────────────
systemctl list-timers 'revops-*'
journalctl -u revops-poll -n 5 --no-pager                 # optional: show it logging itself


# ─────────────────────────────────────────────────────────────
# AFTER THE DEMO  (turn everything back off)
# ─────────────────────────────────────────────────────────────
# 1. Stop the listener: Ctrl+C in its terminal.
# 2. Turn autonomy back off (zero cost between demos):
systemctl disable --now revops-poll.timer revops-digest.timer
# 3. Reset a demo deal so you can re-rehearse the drop:
node --input-type=module -e "import { supabase } from './src/db.js'; const r = await supabase.from('deals').select('id').eq('name','Cobalt Systems').maybeSingle(); if (r.data) { await supabase.from('deals').delete().eq('id', r.data.id); console.log('reset Cobalt'); } else console.log('no Cobalt row'); "
rm -f transcripts/cobalt_systems.txt
```

## Rehearsing the drag-and-drop
Download a staged transcript to your laptop first (they live server-side in `demo/incoming/`:
`cobalt_systems.txt`, `meridian_freight.txt`, `northstar_capital.txt`). Re-dropping the **same**
filename is skipped as already-processed, so rotate through the three — one per rehearsal — or run
the reset one-liner above between runs.

## Fallback (if wifi/API dies mid-demo)
You already ran the clean-state refresh, so **Slack + HubSpot already show the whole story** — just
walk those two tabs and narrate. Optionally show a screenshot of `npm test` (15/0) as proof.
