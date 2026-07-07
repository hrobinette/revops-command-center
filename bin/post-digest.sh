#!/usr/bin/env bash
# Weekly Slack digest of all current deals (the "Monday digest").
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "=== ${ts} monday digest ===" | tee -a logs/scheduled.log
/usr/bin/node src/digest.js 2>&1 | tee -a logs/scheduled.log
