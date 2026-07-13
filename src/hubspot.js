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

/**
 * Fuzzy-search deals by name for the human-in-the-loop confirmation step.
 * Returns [{ id, name }] ranked best-first (exact name wins), so a near-miss
 * header like "Harbor Health" surfaces "Harbor Health – CSPM Expansion" as a
 * candidate instead of silently looking like a brand-new deal.
 */
export async function searchDealsByName(name, limit = 5) {
  const q = (name || '').trim();
  if (!q) return [];
  // Full-text `query` is HubSpot's forgiving "search box" match — tolerant of
  // multi-word names and partial matches where a CONTAINS_TOKEN filter is not.
  const body = await hs('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify({
      query: q,
      properties: ['dealname'],
      limit,
    }),
  });
  const results = (body.results || []).map((r) => ({
    id: r.id,
    name: r.properties?.dealname || '(unnamed)',
  }));
  const lc = q.toLowerCase();
  return results.sort((a, b) => {
    const ax = a.name.toLowerCase() === lc ? 0 : 1;
    const bx = b.name.toLowerCase() === lc ? 0 : 1;
    return ax - bx;
  });
}

/** Create a new deal; return its id. */
export async function createDeal({ name, stage }) {
  const properties = { dealname: name };
  if (stage) properties.dealstage = stage;
  const created = await hs('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  });
  return created.id;
}

/**
 * Ensure a deal exists in HubSpot; return its id. Auto-creates on a miss.
 * Used by the non-interactive CLI/demo path — NOT the Slack approval flow,
 * which asks a human before creating. Self-seeds the demo deals.
 */
export async function upsertDeal({ name }) {
  const existing = await findDealByName(name);
  if (existing) return existing;
  return createDeal({ name });
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
export function buildNoteBody({ deal, trends, flags, summary, resolved }) {
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

  const resolvedHtml = resolved && resolved.length
    ? `<p><b>✅ Closed since last call</b></p><ul>` +
      resolved
        .map(
          (r) =>
            `<li><b>${r.label}</b> — ${r.elements
              .map((e) => `${e.element} ${e.before ?? '-'} → ${e.after ?? '-'}`)
              .join(', ')}</li>`
        )
        .join('') +
      `</ul>`
    : '';

  return [
    `<h3>RevOps Command Center — MEDDPICC scoring</h3>`,
    `<p><b>Deal:</b> ${deal.name} &nbsp; <b>Stage:</b> ${deal.stage || 'unknown'}</p>`,
    summary ? `<p><i>${summary}</i></p>` : '',
    `<table>${rows}</table>`,
    `<p><b>Risk flags</b></p>`,
    flagHtml,
    resolvedHtml,
    `<p style="color:#888;font-size:11px">Auto-generated from the latest call transcript. Scores 0-2 absent · 3-5 unvalidated · 6-8 engaged · 9-10 confirmed.</p>`,
  ]
    .filter(Boolean)
    .join('\n');
}
