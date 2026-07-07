// Trend computation: per-element score series and deltas across a deal's calls.
import { ELEMENTS } from './prompts/meddpicc.js';

/**
 * @param calls array of { id, call_number, scores: [{element, score}] }, oldest first
 * @returns {
 *   latestCall,                     // the most recent call row
 *   latest: { <element>: score },   // latest-call score per element
 *   series: { <element>: [score...] }, // chronological scores per element
 *   deltas: { <element>: [d1, d2...] }, // call-over-call changes
 *   consecutiveDecline: { <element>: n } // length of the current run of decreases
 * }
 */
export function computeTrends(calls) {
  const ordered = [...calls].sort((a, b) => (a.call_number || 0) - (b.call_number || 0));
  const latestCall = ordered[ordered.length - 1] || null;

  const scoreAt = (call, element) => {
    const s = (call.scores || []).find((x) => x.element === element);
    return s ? s.score : null;
  };

  const series = {};
  const deltas = {};
  const consecutiveDecline = {};
  const latest = {};

  for (const el of ELEMENTS) {
    const vals = ordered.map((c) => scoreAt(c, el)).filter((v) => v !== null);
    series[el] = vals;
    latest[el] = vals.length ? vals[vals.length - 1] : null;

    const d = [];
    for (let i = 1; i < vals.length; i++) d.push(vals[i] - vals[i - 1]);
    deltas[el] = d;

    // Count the trailing run of strictly-decreasing steps.
    let run = 0;
    for (let i = d.length - 1; i >= 0; i--) {
      if (d[i] < 0) run++;
      else break;
    }
    consecutiveDecline[el] = run;
  }

  return { latestCall, latest, series, deltas, consecutiveDecline };
}
