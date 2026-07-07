// Post a full deal-health digest of ALL deals to Slack (the "Monday digest").
// Reads current state from Supabase; does not re-score. Run via `npm run digest`
// or on a schedule (systemd timer).
import { listDeals, getDealCallsWithScores } from './db.js';
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';
import { slackEnabled, postDigest } from './slack.js';

export async function runDigest() {
  if (!slackEnabled()) {
    console.log('Slack not configured (SLACK_BOT_TOKEN/SLACK_CHANNEL) — nothing to post.');
    return;
  }
  const deals = await listDeals();
  if (!deals.length) {
    console.log('No deals in the database yet — skipping digest.');
    return;
  }

  const results = [];
  for (const deal of deals) {
    const calls = await getDealCallsWithScores(deal.id);
    const trends = computeTrends(calls);
    const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
    const ctx = {
      modelStage: deal.stage,
      competition: { named_competitor: Boolean(compRow?.named_competitor) },
    };
    results.push({ deal, trends, flags: computeFlags(deal, trends, ctx) });
  }

  await postDigest(results);
  console.log(`Digest posted for ${results.length} deals.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDigest().catch((err) => {
    console.error('Digest failed:', err.message);
    process.exit(1);
  });
}
