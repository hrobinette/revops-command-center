// Week 8 — CRM writeback via a HubSpot Service Key (Bearer token).
// Isolated to this project's .env; never shared with the Nox agent.
import 'dotenv/config';

const TOKEN = process.env.HUBSPOT_TOKEN;
const BASE = 'https://api.hubapi.com';

// note -> deal default association type id (HUBSPOT_DEFINED)
const NOTE_TO_DEAL = 214;

export function hubspotEnabled() {
  return Boolean(TOKEN) && !TOKEN.includes('REPLACE_ME');
}

async function hs(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.message || body?.raw || res.statusText;
    const err = new Error(`HubSpot ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Read a single deal — cheap connectivity + scope check, writes nothing. */
export async function smokeTest() {
  await hs('/crm/v3/objects/deals?limit=1');
  return true;
}

/** Find a deal by exact name; return its id or null. */
export async function findDealByName(name) {
  const body = await hs('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'EQ', value: name }] }],
      properties: ['dealname'],
      limit: 1,
    }),
  });
  return body.results?.[0]?.id || null;
}

/** Ensure a deal exists in HubSpot; return its id. Self-seeds the demo deals. */
export async function upsertDeal({ name }) {
  const existing = await findDealByName(name);
  if (existing) return existing;
  const created = await hs('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({ properties: { dealname: name } }),
  });
  return created.id;
}

/** Create a note and associate it with a deal. `timestamp` is ISO or epoch ms. */
export async function writeNoteToDeal({ dealId, body, timestamp }) {
  const ts = timestamp || new Date().toISOString();
  return hs('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_note_body: body, hs_timestamp: ts },
      associations: [
        {
          to: { id: dealId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_DEAL }],
        },
      ],
    }),
  });
}

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

/**
 * Build the HTML note body the rep sees on the deal in HubSpot.
 * @param deal    { name, stage }
 * @param trends  computeTrends() output (latest per element)
 * @param flags   [{ flag_type, severity, detail }]
 * @param summary the model's 2-3 sentence health assessment for the latest call
 */
export function buildNoteBody({ deal, trends, flags, summary }) {
  const rows = Object.entries(ELEMENT_LABELS)
    .map(([el, label]) => {
      const v = trends.latest[el];
      return `<tr><td>${label}</td><td><b>${v == null ? '-' : v}</b>/10</td></tr>`;
    })
    .join('');

  const flagHtml = flags.length
    ? '<ul>' +
      flags
        .map(
          (f) =>
            `<li>${f.severity === 'red' ? '🔴' : '🟡'} <b>${f.flag_type}</b> — ${f.detail || ''}</li>`
        )
        .join('') +
      '</ul>'
    : '<p>✅ No risk flags — deal looks healthy.</p>';

  return [
    `<h3>RevOps Command Center — MEDDPICC scoring</h3>`,
    `<p><b>Deal:</b> ${deal.name} &nbsp; <b>Stage:</b> ${deal.stage || 'unknown'}</p>`,
    summary ? `<p><i>${summary}</i></p>` : '',
    `<table>${rows}</table>`,
    `<p><b>Risk flags</b></p>`,
    flagHtml,
    `<p style="color:#888;font-size:11px">Auto-generated from the latest call transcript. Scores 0-2 absent · 3-5 unvalidated · 6-8 engaged · 9-10 confirmed.</p>`,
  ]
    .filter(Boolean)
    .join('\n');
}
