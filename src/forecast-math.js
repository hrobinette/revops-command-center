// Pure forecast math, split out from forecast.js so it can be unit-tested with
// no DB/network. Operates on computeTrends() output.
import { ELEMENTS } from './prompts/meddpicc.js';

/** Mean of the latest 8 element scores, 0..1. Null-safe. */
export function completeness(trends) {
  const vals = ELEMENTS.map((e) => trends.latest[e]).filter((v) => v != null);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / (vals.length * 10);
}

/** Overall momentum from the last call-over-call delta of each element. */
export function trajectory(trends) {
  let sum = 0;
  let seen = 0;
  for (const e of ELEMENTS) {
    const d = trends.deltas[e];
    if (d && d.length) {
      sum += d[d.length - 1];
      seen++;
    }
  }
  if (!seen) return { dir: 'new', arrow: '·', mult: 1 };
  if (sum > 0) return { dir: 'improving', arrow: '↑', mult: 1 };
  if (sum < 0) return { dir: 'declining', arrow: '↓', mult: 0.85 }; // extra discount for a stalling deal
  return { dir: 'flat', arrow: '→', mult: 1 };
}

/** Amount weighted by completeness and trajectory. Null amount → null. */
export function riskAdjusted(amount, comp, mult) {
  if (amount == null) return null;
  return Math.round(amount * comp * mult);
}
