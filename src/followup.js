// Next-action follow-up drafter. Picks the deal's single biggest gap and drafts a
// short, specific follow-up email that closes it — the "act, don't just observe"
// step. One Anthropic call per draft. Reuses the pipeline's trends + flags.
//
// CLI:  node src/followup.js --deal "Harbor Health" [--slack]
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { listDeals, getDealCallsWithScores } from './db.js';
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';
import { FOLLOWUP_SYSTEM, buildFollowupPrompt } from './prompts/followup.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey.includes('REPLACE_ME')) {
  throw new Error('Missing ANTHROPIC_API_KEY. Fill it in .env (see .env.example).');
}
const client = new Anthropic({ apiKey });
const MODEL = process.env.MEDDPICC_MODEL || 'claude-sonnet-5';

// What "closing" each element means, phrased as the concrete next move.
const ELEMENT_GAP = {
  economic_buyer: 'secure a conversation with the economic buyer — the person with budget authority',
  metrics: 'quantify the business value and agree on the metrics success will be measured by',
  identify_pain: 'confirm and deepen the specific, owned business pain that motivates action',
  decision_criteria: 'surface the explicit criteria the buyer will use to choose a vendor',
  decision_process: 'map the decision process — the steps, approvals, and timeline',
  paper_process: 'kick off the procurement / security review / legal paper process',
  champion: 're-engage and arm the internal champion so they can sell on your behalf',
  competition: 'differentiate clearly against the competing option in play',
};

// Each risk flag points at the element whose gap it represents.
const FLAG_ELEMENT = {
  NO_EB_LATE_STAGE: 'economic_buyer',
  CHAMPION_DECLINE: 'champion',
  NO_PAPER_PROCESS_LATE: 'paper_process',
  UNQUALIFIED: 'identify_pain',
  COMPETITIVE_EXPOSURE: 'decision_criteria',
};

/** Choose the element to target: worst active flag first, else the lowest-scored element. */
export function pickTargetElement(trends, flags) {
  const red = (flags || []).find((f) => f.severity === 'red');
  const yellow = (flags || []).find((f) => f.severity === 'yellow');
  const chosen = red || yellow;
  if (chosen && FLAG_ELEMENT[chosen.flag_type]) return FLAG_ELEMENT[chosen.flag_type];

  let lo = null;
  let loEl = null;
  for (const [el, v] of Object.entries(trends.latest)) {
    if (v == null) continue;
    if (lo == null || v < lo) {
      lo = v;
      loEl = el;
    }
  }
  return loEl;
}

/**
 * Draft a follow-up email that closes the deal's biggest gap.
 * @returns { target_gap, subject, body, rationale }
 */
export async function draftFollowup({ deal, trends, flags, summary }) {
  const targetElement = pickTargetElement(trends, flags);
  if (!targetElement) throw new Error('No scored elements — cannot pick a gap to close.');

  const scoreRow = (trends.latestCall?.scores || []).find((s) => s.element === targetElement);
  const attendees = trends.latestCall?.attendees || [];
  // A rough "contact": first non-vendor attendee name, if the record has one.
  const contact = (attendees.find((a) => !/shieldpoint/i.test(a)) || '').split('(')[0].trim() || null;

  const prompt = buildFollowupPrompt({
    dealName: deal.name,
    company: deal.company,
    stage: deal.stage,
    targetElement,
    gapInstruction: ELEMENT_GAP[targetElement] || `improve ${targetElement}`,
    gapScore: trends.latest[targetElement],
    evidence: scoreRow?.evidence,
    summary,
    contact,
  });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: FOLLOWUP_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Follow-up draft: no JSON in model response');
  const draft = JSON.parse(text.slice(start, end + 1));
  return {
    target_gap: draft.target_gap || targetElement,
    subject: draft.subject || '(no subject)',
    body: draft.body || '',
    rationale: draft.rationale || '',
  };
}

/** Load a deal by (fuzzy) name, compute its state, and draft the follow-up. */
export async function draftFollowupForDeal(nameQuery) {
  const deals = await listDeals();
  const q = nameQuery.toLowerCase();
  const deal =
    deals.find((d) => d.name.toLowerCase() === q) ||
    deals.find((d) => d.name.toLowerCase().includes(q));
  if (!deal) throw new Error(`No deal matching "${nameQuery}". Known: ${deals.map((d) => d.name).join(', ')}`);

  const calls = await getDealCallsWithScores(deal.id);
  const trends = computeTrends(calls);
  const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
  const flags = computeFlags(deal, trends, {
    modelStage: deal.stage,
    competition: { named_competitor: Boolean(compRow?.named_competitor) },
  });
  const draft = await draftFollowup({ deal, trends, flags, summary: '' });
  return { deal, draft };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  let dealName = null;
  let toSlack = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--deal') dealName = argv[++i];
    else if (argv[i] === '--slack') toSlack = true;
    else if (!dealName) dealName = argv[i];
  }
  if (!dealName) {
    console.error('Usage: node src/followup.js --deal "<deal name>" [--slack]');
    process.exit(1);
  }
  draftFollowupForDeal(dealName)
    .then(async ({ deal, draft }) => {
      console.log(`\n📧 Follow-up for ${deal.name} — targeting the ${draft.target_gap} gap\n`);
      console.log(`Subject: ${draft.subject}\n`);
      console.log(draft.body);
      console.log(`\n(Why: ${draft.rationale})\n`);
      if (toSlack) {
        const { slackEnabled, postFollowupDraft } = await import('./slack.js');
        if (slackEnabled()) {
          await postFollowupDraft(deal, draft);
          console.log('↳ Posted to Slack.');
        } else {
          console.log('⚠ Slack not configured — printed only.');
        }
      }
    })
    .catch((err) => {
      console.error('Follow-up failed:', err.message);
      process.exit(1);
    });
}
