import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

function client() {
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export const ELEMENTS = [
  'metrics',
  'economic_buyer',
  'decision_criteria',
  'decision_process',
  'paper_process',
  'identify_pain',
  'champion',
  'competition',
];

export const LABELS = {
  metrics: 'Metrics',
  economic_buyer: 'Economic Buyer',
  decision_criteria: 'Decision Criteria',
  decision_process: 'Decision Process',
  paper_process: 'Paper Process',
  identify_pain: 'Identify Pain',
  champion: 'Champion',
  competition: 'Competition',
};

export function health(flags) {
  if (flags.some((f) => f.severity === 'red')) return 'critical';
  if (flags.some((f) => f.severity === 'yellow')) return 'warning';
  return 'good';
}

async function loadAll() {
  const sb = client();
  const [deals, calls, scores, flags] = await Promise.all([
    sb.from('deals').select('*').order('name'),
    sb.from('calls').select('id,deal_id,call_number'),
    sb.from('scores').select('call_id,deal_id,element,score'),
    sb.from('flags').select('deal_id,flag_type,severity,detail'),
  ]);
  for (const r of [deals, calls, scores, flags]) if (r.error) throw r.error;
  return { deals: deals.data, calls: calls.data, scores: scores.data, flags: flags.data };
}

/** All deals with latest-call scores, champion trend, flags, and a health level. */
export async function getOverview() {
  const { deals, calls, scores, flags } = await loadAll();
  return deals.map((deal) => {
    const dcalls = calls
      .filter((c) => c.deal_id === deal.id)
      .sort((a, b) => (a.call_number || 0) - (b.call_number || 0));
    const latest = dcalls[dcalls.length - 1];
    const latestScores = {};
    if (latest) scores.filter((s) => s.call_id === latest.id).forEach((s) => (latestScores[s.element] = s.score));
    const championSeries = dcalls.map((c) => {
      const s = scores.find((x) => x.call_id === c.id && x.element === 'champion');
      return { call: c.call_number, score: s ? s.score : null };
    });
    const dflags = flags.filter((f) => f.deal_id === deal.id);
    return {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      latest: latestScores,
      championSeries,
      flags: dflags,
      health: health(dflags),
      callCount: dcalls.length,
    };
  });
}

/** One deal: calls (ordered) with all scores, plus flags. */
export async function getDeal(id) {
  const { deals, calls, scores, flags } = await loadAll();
  const deal = deals.find((d) => d.id === id);
  if (!deal) return null;
  const dcalls = calls
    .filter((c) => c.deal_id === id)
    .sort((a, b) => (a.call_number || 0) - (b.call_number || 0))
    .map((c) => ({
      call: c.call_number,
      scores: Object.fromEntries(scores.filter((s) => s.call_id === c.id).map((s) => [s.element, s.score])),
    }));
  const dflags = flags.filter((f) => f.deal_id === id);
  return { deal, calls: dcalls, flags: dflags, health: health(dflags) };
}
