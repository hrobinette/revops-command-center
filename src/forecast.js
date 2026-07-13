// Risk-adjusted forecast roll-up. Weights each deal's dollar amount by its
// MEDDPICC completeness and trajectory, so leadership sees committed pipeline
// vs. what's actually de-risked — not a flat sum that treats a healthy deal and
// a stalling one the same.
//
// Amount source: data/deal-amounts.json (see that file's note). Everything else
// is derived from the scores already in Supabase.
//
// CLI:  node src/forecast.js [--slack]
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { listDeals, getDealCallsWithScores } from './db.js';
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';
import { completeness, trajectory, riskAdjusted as riskAdjustedAmount } from './forecast-math.js';

const AMOUNTS_FILE = path.resolve(process.cwd(), 'data', 'deal-amounts.json');

async function loadAmounts() {
  try {
    const raw = JSON.parse(await readFile(AMOUNTS_FILE, 'utf8'));
    const map = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      if (typeof v === 'number') map[k.toLowerCase()] = v;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Build the forecast rows + totals.
 * @returns { rows: [...], committed, riskAdjusted, unpriced: [names] }
 */
export async function computeForecast() {
  const amounts = await loadAmounts();
  const deals = await listDeals();

  const rows = [];
  const unpriced = [];
  let committed = 0;
  let riskAdjusted = 0;

  for (const deal of deals) {
    const calls = await getDealCallsWithScores(deal.id);
    const trends = computeTrends(calls);
    const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
    const flags = computeFlags(deal, trends, {
      modelStage: deal.stage,
      competition: { named_competitor: Boolean(compRow?.named_competitor) },
    });

    const amount = amounts[deal.name.toLowerCase()] ?? null;
    const comp = completeness(trends);
    const traj = trajectory(trends);
    const hasRed = flags.some((f) => f.severity === 'red');
    // Risk-adjusted value: amount weighted by completeness and trajectory.
    const risk = riskAdjustedAmount(amount, comp, traj.mult);

    if (amount == null) unpriced.push(deal.name);
    else {
      committed += amount;
      riskAdjusted += risk;
    }

    rows.push({
      name: deal.name,
      stage: deal.stage || '?',
      amount,
      completeness: comp,
      trajectory: traj,
      hasRed,
      flags: flags.map((f) => f.flag_type),
      risk,
    });
  }

  // Worst-risk first (biggest committed-vs-risk-adjusted dollar erosion).
  rows.sort((a, b) => {
    const ea = a.amount == null ? -1 : a.amount - a.risk;
    const eb = b.amount == null ? -1 : b.amount - b.risk;
    return eb - ea;
  });

  return { rows, committed, riskAdjusted, unpriced };
}

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (f) => Math.round(f * 100) + '%';

function printForecast({ rows, committed, riskAdjusted, unpriced }) {
  console.log('\n📈 Risk-adjusted pipeline forecast\n');
  const header = ['Deal', 'Stage', 'Amount', 'MEDDPICC', 'Trend', 'Risk-adj', 'Flags'];
  const body = rows.map((r) => [
    r.name,
    r.stage,
    r.amount == null ? '—' : usd(r.amount),
    pct(r.completeness),
    `${r.trajectory.arrow} ${r.trajectory.dir}`,
    r.risk == null ? '—' : usd(r.risk),
    r.hasRed ? `🔴 ${r.flags.join(', ')}` : r.flags.length ? `🟡 ${r.flags.join(', ')}` : '✓',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => String(row[i]).length)));
  const fmt = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(fmt(header));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const row of body) console.log(fmt(row));

  const erosion = committed - riskAdjusted;
  const erosionPct = committed ? Math.round((erosion / committed) * 100) : 0;
  console.log('\n' + '─'.repeat(60));
  console.log(`Committed pipeline:      ${usd(committed)}`);
  console.log(`Risk-adjusted pipeline:  ${usd(riskAdjusted)}   (−${usd(erosion)}, ${erosionPct}% risk discount)`);
  if (unpriced.length) console.log(`\nNo amount on file (excluded from $ totals): ${unpriced.join(', ')}`);
  console.log('');
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const toSlack = process.argv.slice(2).includes('--slack');
  computeForecast()
    .then(async (fc) => {
      printForecast(fc);
      if (toSlack) {
        const { slackEnabled, postForecast } = await import('./slack.js');
        if (slackEnabled()) {
          await postForecast(fc);
          console.log('↳ Posted forecast to Slack.\n');
        } else {
          console.log('⚠ Slack not configured — printed only.\n');
        }
      }
    })
    .catch((err) => {
      console.error('Forecast failed:', err.message);
      process.exit(1);
    });
}
