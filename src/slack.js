// Week 8 — Slack delivery for the "RevOps Command Center" bot.
// Posts a deal-health digest and fires alerts for red-flagged deals.
// Uses its own bot token (SLACK_BOT_TOKEN) — a distinct identity from Nox.
import 'dotenv/config';

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
      ? flags.map((f) => f.flag_type).join(', ')
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
        text: reds.map((f) => `• *${f.flag_type}* — ${f.detail || ''}`).join('\n'),
      },
    },
  ];

  return postMessage({ text: `🔴 ${deal.name} needs attention`, blocks });
}

/** Full scorecard for a single freshly-ingested deal — the reply to a dropped transcript. */
export async function postDealCard(deal, trends, flags) {
  const ind = healthIndicator(flags);
  const scores = Object.entries(ELEMENT_LABELS)
    .map(([el, label]) => `${label}: *${trends.latest[el] ?? '-'}*`)
    .join('  ·  ');
  const flagBlock = flags.length
    ? flags
        .map((f) => `${f.severity === 'red' ? '🔴' : '🟡'} *${f.flag_type}* — ${f.detail || ''}`)
        .join('\n')
    : '✅ No risk flags — healthy deal.';

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${ind} ${deal.name} — scored`, emoji: true } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Stage: *${deal.stage || 'unknown'}*  ·  synced to HubSpot` }],
    },
    { type: 'section', text: { type: 'mrkdwn', text: scores } },
    { type: 'section', text: { type: 'mrkdwn', text: flagBlock } },
  ];

  return postMessage({ text: `${deal.name} scored — ${flags.length} flag(s)`, blocks });
}
