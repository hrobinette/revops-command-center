// Test harness: reprocess all transcripts, then validate behavior against
// tests/expectations.json. Asserts score BANDS (not exact scores) and EXACT flag
// behavior — a flag firing that isn't expected is a failure (false positives matter).
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runPipeline } from '../src/process.js';

const EXPECT_PATH = path.resolve(process.cwd(), 'tests/expectations.json');

function scoreOnCall(trends, element, callNumber) {
  if (callNumber == null) return trends.latest[element];
  const idx = callNumber - 1; // series is 1-indexed by call
  const series = trends.series[element] || [];
  return idx >= 0 && idx < series.length ? series[idx] : null;
}

async function main() {
  const expectations = JSON.parse(await readFile(EXPECT_PATH, 'utf8'));

  console.log('Running full pipeline (--all) before assertions...\n');
  const { deals } = await runPipeline({ all: true, quiet: true });

  const byName = new Map(deals.map((d) => [d.deal.name, d]));
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const [name, spec] of Object.entries(expectations.deals)) {
    const result = byName.get(name);
    if (!result) {
      failed++;
      failures.push(`${name}: deal not found in pipeline output (missing/misnamed transcript?)`);
      continue;
    }

    // Flags must match exactly.
    const fired = new Set(result.flags.map((f) => f.flag_type));
    const expected = new Set(spec.flags_expected || []);
    for (const f of expected) {
      if (!fired.has(f)) {
        failed++;
        failures.push(`${name}: expected flag ${f} did NOT fire`);
      } else passed++;
    }
    for (const f of fired) {
      if (!expected.has(f)) {
        failed++;
        failures.push(`${name}: FALSE POSITIVE — ${f} fired but was not expected`);
      }
    }

    // Score bands.
    for (const [element, band] of Object.entries(spec.bands || {})) {
      const val = scoreOnCall(result.trends, element, band.call);
      const callLabel = band.call ? ` (call ${band.call})` : '';
      if (val == null) {
        failed++;
        failures.push(`${name}: ${element}${callLabel} has no score`);
        continue;
      }
      if (band.min != null && val < band.min) {
        failed++;
        failures.push(`${name}: ${element}${callLabel}=${val} below min ${band.min}`);
      } else if (band.max != null && val > band.max) {
        failed++;
        failures.push(`${name}: ${element}${callLabel}=${val} above max ${band.max}`);
      } else {
        passed++;
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('✓ All expectations met.\n');
}

main().catch((err) => {
  console.error('Test harness error:', err.message);
  process.exit(1);
});
