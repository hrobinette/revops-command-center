// Gap-closed loop tracking: detect risk flags that fired on a prior call but no
// longer fire on the latest one. Turns the alert stream into a closed loop —
// "Harbor closed its economic-buyer gap" — and proves the system's impact.
//
// A resolution is computed, not stored: recompute the flags as-of the previous
// call and diff against the current flags. Purely derived from the score history
// already in Supabase, so it needs no new table and no new extraction.
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';

// Each flag maps to the element(s) whose recovery closes it, plus a human label.
const FLAG_META = {
  NO_EB_LATE_STAGE: { elements: ['economic_buyer'], label: 'economic-buyer gap' },
  CHAMPION_DECLINE: { elements: ['champion'], label: 'champion decline' },
  NO_PAPER_PROCESS_LATE: { elements: ['paper_process'], label: 'paper-process gap' },
  UNQUALIFIED: { elements: ['metrics', 'identify_pain'], label: 'qualification gap' },
  COMPETITIVE_EXPOSURE: { elements: ['decision_criteria'], label: 'competitive-exposure gap' },
};

function ctxFor(deal, trends) {
  const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
  return { modelStage: deal.stage, competition: { named_competitor: Boolean(compRow?.named_competitor) } };
}

/**
 * Flags that fired on the previous call but not on the latest one.
 * Requires >= 2 calls; returns [] otherwise.
 * @param deal          { id, stage }
 * @param calls         all of the deal's calls with scores (any order)
 * @param currentFlags  flags already computed for the latest call
 * @returns [{ flag_type, label, elements: [{ element, before, after }] }]
 */
export function computeResolvedFlags(deal, calls, currentFlags) {
  if (!calls || calls.length < 2) return [];
  const ordered = [...calls].sort((a, b) => (a.call_number || 0) - (b.call_number || 0));
  const prevTrends = computeTrends(ordered.slice(0, -1));
  const currTrends = computeTrends(ordered);
  const prevFlags = computeFlags(deal, prevTrends, ctxFor(deal, prevTrends));
  const currentTypes = new Set((currentFlags || []).map((f) => f.flag_type));

  const resolved = [];
  for (const pf of prevFlags) {
    if (currentTypes.has(pf.flag_type)) continue; // still firing — not resolved
    const meta = FLAG_META[pf.flag_type] || { elements: [], label: pf.flag_type };
    const elements = meta.elements.map((el) => ({
      element: el,
      before: prevTrends.latest[el],
      after: currTrends.latest[el],
    }));
    resolved.push({ flag_type: pf.flag_type, label: meta.label, elements });
  }
  return resolved;
}

/** One-line human summary, e.g. "economic-buyer gap closed (economic_buyer 3 → 7)". */
export function describeResolution(r) {
  const parts = r.elements
    .filter((e) => e.before != null || e.after != null)
    .map((e) => `${e.element} ${e.before ?? '-'} → ${e.after ?? '-'}`);
  return `${r.label} closed${parts.length ? ` (${parts.join(', ')})` : ''}`;
}
