// Offline unit tests for the pure demo-critical logic: gap-closed resolutions
// and the forecast math. No DB, no network, no API cost. Run: npm run test:unit
import { ELEMENTS } from '../src/prompts/meddpicc.js';
import { computeTrends } from '../src/trends.js';
import { computeFlags } from '../src/flags.js';
import { computeResolvedFlags, describeResolution } from '../src/resolutions.js';
import { completeness, trajectory, riskAdjusted } from '../src/forecast-math.js';

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, got) {
  if (cond) pass++;
  else {
    fail++;
    failures.push(`${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), a);

// A call with all 8 elements scored; overrides set specific elements. Default 6
// keeps a call flag-free unless an override pushes an element into a rule.
function mk(n, overrides = {}) {
  return {
    call_number: n,
    scores: ELEMENTS.map((el) => ({
      element: el,
      score: overrides[el] ?? 6,
      named_competitor: el === 'competition' ? Boolean(overrides.named_competitor) : undefined,
    })),
  };
}
const ctx = (deal, trends) => ({ modelStage: deal.stage, competition: { named_competitor: false } });
function pipeline(deal, calls) {
  const trends = computeTrends(calls);
  const flags = computeFlags(deal, trends, ctx(deal, trends));
  return { trends, flags, resolved: computeResolvedFlags(deal, calls, flags) };
}

// ── forecast math ────────────────────────────────────────────────────────────
eq('completeness: all 6 → 0.6', completeness(computeTrends([mk(1)])).toFixed(3), (0.6).toFixed(3));
eq('completeness: all 10 → 1.0', completeness(computeTrends([mk(1, Object.fromEntries(ELEMENTS.map((e) => [e, 10])))])), 1);
eq(
  'completeness: metrics 8 rest 6 → 0.625',
  completeness(computeTrends([mk(1, { metrics: 8 })])).toFixed(3),
  (0.625).toFixed(3)
);

eq('trajectory: single call → new/1', trajectory(computeTrends([mk(1)])), { dir: 'new', arrow: '·', mult: 1 });
eq('trajectory: improving → mult 1', trajectory(computeTrends([mk(1, { metrics: 3 }), mk(2, { metrics: 7 })])), {
  dir: 'improving',
  arrow: '↑',
  mult: 1,
});
eq('trajectory: declining → mult 0.85', trajectory(computeTrends([mk(1, { champion: 7 }), mk(2, { champion: 2 })])), {
  dir: 'declining',
  arrow: '↓',
  mult: 0.85,
});
eq('trajectory: flat → mult 1', trajectory(computeTrends([mk(1), mk(2)])), { dir: 'flat', arrow: '→', mult: 1 });

eq('riskAdjusted: 1000×0.5×1', riskAdjusted(1000, 0.5, 1), 500);
eq('riskAdjusted: 1000×0.5×0.85', riskAdjusted(1000, 0.5, 0.85), 425);
eq('riskAdjusted: null amount', riskAdjusted(null, 0.5, 1), null);

// ── gap-closed resolutions ───────────────────────────────────────────────────
const proposal = { id: 'd', stage: 'proposal' };

// EB recovers: NO_EB_LATE_STAGE resolves, before 3 → after 7
{
  const { resolved } = pipeline(proposal, [mk(1, { economic_buyer: 3, paper_process: 6 }), mk(2, { economic_buyer: 7, paper_process: 6 })]);
  eq('EB recovery resolves NO_EB_LATE_STAGE', resolved.map((r) => r.flag_type), ['NO_EB_LATE_STAGE']);
  eq('EB resolution before/after', resolved[0]?.elements[0], { element: 'economic_buyer', before: 3, after: 7 });
  eq('describeResolution text', describeResolution(resolved[0]), 'economic-buyer gap closed (economic_buyer 3 → 7)');
}

// Champion decline then recovery: CHAMPION_DECLINE resolves
{
  const calls = [mk(1, { champion: 7 }), mk(2, { champion: 4 }), mk(3, { champion: 2 }), mk(4, { champion: 7 })];
  const { flags, resolved } = pipeline(proposal, calls);
  check('champion recovered → no active CHAMPION_DECLINE', !flags.some((f) => f.flag_type === 'CHAMPION_DECLINE'));
  eq('CHAMPION_DECLINE resolves', resolved.map((r) => r.flag_type), ['CHAMPION_DECLINE']);
}

// Single call → nothing resolves
eq('single call → []', pipeline(proposal, [mk(1, { economic_buyer: 3 })]).resolved, []);

// Still firing → nothing resolves
eq(
  'still-firing EB → []',
  pipeline(proposal, [mk(1, { economic_buyer: 3 }), mk(2, { economic_buyer: 3 })]).resolved,
  []
);

// Partial: EB closes but paper process still open → only NO_EB resolves
{
  const { resolved } = pipeline(proposal, [
    mk(1, { economic_buyer: 3, paper_process: 2 }),
    mk(2, { economic_buyer: 7, paper_process: 2 }),
  ]);
  eq('partial: only NO_EB_LATE_STAGE resolves', resolved.map((r) => r.flag_type), ['NO_EB_LATE_STAGE']);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ All unit tests passed.\n');
