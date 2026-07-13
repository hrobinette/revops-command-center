#!/usr/bin/env bash
# Poll: process any NEW transcripts, then alert Slack.
# Idle-safe — does nothing (and posts nothing) when there are no new transcripts.
#
# NO --push-hubspot here on purpose: autonomous/scheduled runs never write to the
# CRM. HubSpot writeback requires a human to approve it (Update/Create/Skip) via
# the Slack listener (src/slack-listener.js). No human present = no CRM write.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "=== ${ts} poll ===" | tee -a logs/scheduled.log
/usr/bin/node src/process.js --notify-slack 2>&1 | tee -a logs/scheduled.log
