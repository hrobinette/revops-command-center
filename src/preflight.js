// Preflight: verify every live dependency is reachable before a demo or run.
// Checks Anthropic, Supabase, Slack, and HubSpot independently — one failing
// check never aborts the others. Exit 0 only if nothing is broken (unconfigured
// services are warned, not failed). Run: npm run preflight
//
// Deliberately self-contained on credentials: it builds its own clients so a
// missing key surfaces as a ⚠ on that one line instead of crashing the whole run
// (importing db.js/score.js throws at load time when their creds are absent).
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { hubspotEnabled, smokeTest as hubspotSmoke } from './hubspot.js';
import { slackEnabled, smokeTest as slackSmoke } from './slack.js';

const isSet = (v) => Boolean(v) && !v.includes('REPLACE_ME');

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.MEDDPICC_MODEL || 'claude-sonnet-5';
  if (!isSet(key)) return { name: 'Anthropic', state: 'skip', detail: 'ANTHROPIC_API_KEY not set' };
  try {
    // models.list validates the key + reachability without spending generation tokens.
    await new Anthropic({ apiKey: key }).models.list({ limit: 1 });
    return { name: 'Anthropic', state: 'ok', detail: `reachable · scoring model ${model}` };
  } catch (e) {
    return { name: 'Anthropic', state: 'fail', detail: e.message };
  }
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!isSet(url) || !isSet(key)) {
    return { name: 'Supabase', state: 'skip', detail: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' };
  }
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { count, error } = await sb.from('deals').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { name: 'Supabase', state: 'ok', detail: `reachable · ${count} deals in DB` };
  } catch (e) {
    return { name: 'Supabase', state: 'fail', detail: e.message };
  }
}

async function checkSlack() {
  if (!slackEnabled()) return { name: 'Slack', state: 'skip', detail: 'SLACK_BOT_TOKEN / SLACK_CHANNEL not set' };
  try {
    const r = await slackSmoke();
    return { name: 'Slack', state: 'ok', detail: `authed as ${r.user} · team ${r.team} · ${process.env.SLACK_CHANNEL}` };
  } catch (e) {
    return { name: 'Slack', state: 'fail', detail: e.message };
  }
}

async function checkHubspot() {
  if (!hubspotEnabled()) return { name: 'HubSpot', state: 'skip', detail: 'HUBSPOT_TOKEN not set' };
  try {
    await hubspotSmoke();
    return { name: 'HubSpot', state: 'ok', detail: 'reachable · deals scope OK' };
  } catch (e) {
    return { name: 'HubSpot', state: 'fail', detail: e.message };
  }
}

async function main() {
  const checks = await Promise.all([checkAnthropic(), checkSupabase(), checkSlack(), checkHubspot()]);
  const icon = { ok: '✅', fail: '❌', skip: '⚠️ ' };
  const w = Math.max(...checks.map((c) => c.name.length));
  console.log('\nRevOps Command Center — preflight\n');
  for (const c of checks) console.log(`${icon[c.state]} ${c.name.padEnd(w)}  ${c.detail}`);
  console.log('');

  const failed = checks.filter((c) => c.state === 'fail');
  const skipped = checks.filter((c) => c.state === 'skip');
  if (failed.length) {
    console.log(`❌ ${failed.length} check(s) failed — NOT demo-ready. Fix before going live.\n`);
    process.exit(1);
  }
  if (skipped.length) {
    console.log(`⚠️  Reachable, but not configured: ${skipped.map((c) => c.name).join(', ')}.\n`);
    process.exit(0);
  }
  console.log('✅ All systems go — demo-ready.\n');
}

main().catch((e) => {
  console.error('Preflight error:', e.message);
  process.exit(1);
});
