// Week 8 — Slack delivery for the "RevOps Command Center" bot.
// Posts a deal-health digest and fires alerts for red-flagged deals.
// Uses its own bot token (SLACK_BOT_TOKEN) — a distinct identity from Nox.
import 'dotenv/config';
import { flagLabel } from './flags.js';

const TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL = process.env.SLACK_CHANNEL;
const API = 'https://slack.com/api';

export function slackEnabled() {
  return Boolean(TOKEN) && !TOKEN.includes('REPLACE_ME') && Boolean(CHANNEL) && !CHANNEL.includes('REPLACE_ME');
}

async function slack(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.ok) {
    const err = new Error(`Slack ${method} failed: ${body.error}`);
    err.slack = body;
    throw err;
  }
  return body;
}

/** Verify the token works (and identify the bot). Writes nothing to channels. */
export async function smokeTest() {
  const res = await fetch(`${API}/auth.test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`Slack auth.test failed: ${body.error}`);
  return body; // { team, user (bot name), ... }
}

async function postMessage({ text, blocks }) {
  return slack('chat.postMessage', { channel: CHANNEL, text, blocks });
}

// Element labels for the scorecard (mirrors hubspot.js). Kept local so slack.js
// has no cross-module dependency for rendering.
const ELEMENT_LABELS = {
  metrics: 'Metrics',
  economic_buyer: 'Economic Buyer',
  decision_criteria: 'Decision Criteria',
  decision_process: 'Decision Process',
  paper_process: 'Paper Process',
  identify_pain: 'Identify Pain',
  champion: 'Champion',
  competition: 'Competition',
};

function healthIndicator(flags) {
  if (flags.some((f) => f.severity === 'red')) return '🔴';
  if (flags.some((f) => f.severity === 'yellow')) return '🟡';
  return '✅';
}

/**
 * Monday-style digest of every scored deal, one line each.
 * @param results [{ deal, trends, flags }]
 */
export async function postDigest(results) {
  const sorted = [...results].sort((a, b) => a.deal.name.localeCompare(b.deal.name));
  const lines = sorted.map(({ deal, flags }) => {
    const ind = healthIndicator(flags);
    const flagStr = flags.length
      ? flags.map((f) => flagLabel(f.flag_type)).join(', ')
      : 'clean';
    return `${ind}  *${deal.name}*  ·  _${deal.stage || 'unknown'}_  ·  ${flagStr}`;
  });

  const redCount = sorted.filter((r) => r.flags.some((f) => f.severity === 'red')).length;
  const yellowCount = sorted.filter(
    (r) => !r.flags.some((f) => f.severity === 'red') && r.flags.some((f) => f.severity === 'yellow')
  ).length;
  const cleanCount = sorted.length - redCount - yellowCount;

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '📊 RevOps Command Center — Deal Health Digest', emoji: true } },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${sorted.length} deals scored  ·  🔴 ${redCount} critical  ·  🟡 ${yellowCount} watch  ·  ✅ ${cleanCount} healthy`,
        },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
  ];

  return postMessage({
    text: `RevOps digest — ${redCount} critical, ${yellowCount} watch, ${cleanCount} healthy`,
    blocks,
  });
}

/**
 * Fire a focused alert for a single red-flagged deal.
 * @param deal   { name, stage }
 * @param flags  the deal's flags (only red ones are surfaced in the alert body)
 */
export async function postAlert(deal, flags) {
  const reds = flags.filter((f) => f.severity === 'red');
  if (!reds.length) return null;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔴 *${deal.name}* needs attention  ·  _${deal.stage || 'unknown'}_`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: reds.map((f) => `• *${flagLabel(f.flag_type)}* — ${f.detail || ''}`).join('\n'),
      },
    },
  ];

  return postMessage({ text: `🔴 ${deal.name} needs attention`, blocks });
}

/**
 * Positive alert: risk flags that closed since the previous call.
 * @param deal      { name, stage }
 * @param resolved  computeResolvedFlags() output
 */
export async function postResolution(deal, resolved) {
  if (!resolved || !resolved.length) return null;
  const lines = resolved.map(
    (r) =>
      `✅ *${r.label} closed* — ${r.elements
        .map((e) => `${e.element} ${e.before ?? '-'} → ${e.after ?? '-'}`)
        .join(', ')}`
  );
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🎉 *${deal.name}* is de-risking  ·  _${deal.stage || 'unknown'}_` },
    },
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
  ];
  return postMessage({ text: `${deal.name} closed ${resolved.length} gap(s)`, blocks });
}

/**
 * Post a drafted follow-up email the rep can copy and send.
 * @param deal   { name }
 * @param draft  { target_gap, subject, body, rationale }
 */
export async function postFollowupDraft(deal, draft) {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `📧 *Suggested follow-up for ${deal.name}* — closes the *${draft.target_gap}* gap` },
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*Subject:* ${draft.subject}` } },
    { type: 'section', text: { type: 'mrkdwn', text: draft.body } },
    draft.rationale ? { type: 'context', elements: [{ type: 'mrkdwn', text: `Why: ${draft.rationale}` }] } : null,
  ].filter(Boolean);
  return postMessage({ text: `Suggested follow-up for ${deal.name}`, blocks });
}

/**
 * Post the risk-adjusted forecast roll-up.
 * @param fc  computeForecast() output { rows, committed, riskAdjusted, unpriced }
 */
export async function postForecast({ rows, committed, riskAdjusted, unpriced }) {
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const lines = rows
    .filter((r) => r.amount != null)
    .map((r) => {
      const ind = r.hasRed ? '🔴' : r.flags.length ? '🟡' : '✅';
      return `${ind} *${r.name}*  ·  ${usd(r.amount)} → *${usd(r.risk)}*  ·  ${Math.round(r.completeness * 100)}% ${r.trajectory.arrow}`;
    });
  const erosion = committed - riskAdjusted;
  const erosionPct = committed ? Math.round((erosion / committed) * 100) : 0;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '📈 Risk-adjusted pipeline forecast', emoji: true } },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Committed *${usd(committed)}*  ·  risk-adjusted *${usd(riskAdjusted)}*  ·  ${erosionPct}% risk discount`,
        },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
  ];
  if (unpriced && unpriced.length) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `No amount on file: ${unpriced.join(', ')}` }] });
  }
  return postMessage({ text: `Forecast: ${usd(riskAdjusted)} risk-adjusted of ${usd(committed)} committed`, blocks });
}

/** Full scorecard for a single freshly-ingested deal — the reply to a dropped transcript. */
export async function postDealCard(deal, trends, flags, resolved = []) {
  const ind = healthIndicator(flags);
  const scores = Object.entries(ELEMENT_LABELS)
    .map(([el, label]) => `${label}: *${trends.latest[el] ?? '-'}*`)
    .join('  ·  ');
  const flagBlock = flags.length
    ? flags
        .map((f) => `${f.severity === 'red' ? '🔴' : '🟡'} *${flagLabel(f.flag_type)}* — ${f.detail || ''}`)
        .join('\n')
    : '✅ No risk flags — healthy deal.';

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${ind} ${deal.name} — scored`, emoji: true } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Stage: *${deal.stage || 'unknown'}*  ·  scored & saved` }],
    },
    { type: 'section', text: { type: 'mrkdwn', text: scores } },
    { type: 'section', text: { type: 'mrkdwn', text: flagBlock } },
  ];

  if (resolved && resolved.length) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: resolved
          .map((r) => `✅ *Closed since last call:* ${r.label} (${r.elements
            .map((e) => `${e.element} ${e.before ?? '-'} → ${e.after ?? '-'}`)
            .join(', ')})`)
          .join('\n'),
      },
    });
  }

  return postMessage({ text: `${deal.name} scored — ${flags.length} flag(s)`, blocks });
}
