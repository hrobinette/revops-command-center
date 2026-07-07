#!/usr/bin/env bash
# Poll: process any NEW transcripts, then sync to HubSpot + Slack.
# Idle-safe — does nothing (and posts nothing) when there are no new transcripts.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "=== ${ts} poll ===" | tee -a logs/scheduled.log
/usr/bin/node src/process.js --push-hubspot --notify-slack 2>&1 | tee -a logs/scheduled.log
