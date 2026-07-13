// Ask-the-pipeline: natural-language questions over the scored pipeline. Loads a
// compact snapshot of every deal (latest MEDDPICC scores, trend series, flags,
// amount) from Supabase and asks Claude to answer grounded in that data only.
// The dataset is small (a handful of deals), so this is load-and-reason, not
// text-to-SQL — no query generation, no injection surface.
//
// CLI:  node src/ask.js "which proposal-stage deals have no economic buyer?"
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { listDeals, getDealCallsWithScores } from './db.js';
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';
import { ELEMENTS } from './prompts/meddpicc.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey.includes('REPLACE_ME')) {
  throw new Error('Missing ANTHROPIC_API_KEY. Fill it in .env (see .env.example).');
}
const client = new Anthropic({ apiKey });
const MODEL = process.env.MEDDPICC_MODEL || 'claude-sonnet-5';

const SYSTEM = `You are a revenue operations analyst. Answer the user's question about the sales
pipeline using ONLY the JSON data provided. Rules:
- Cite specific deal names and scores to back every claim.
- Be concise: a direct answer, then a short supporting list if useful.
- MEDDPICC element scores are 0-10, higher is better. "scores" holds the latest call's value per element;
  "series" holds the value across calls oldest-to-newest (use it for trend/decline questions).
- "flags" are active risk flags. "amount" is annual contract value in USD (may be null).
- If the data does not contain the answer, say so plainly. Never invent deals, numbers, or facts.`;

async function loadAmounts() {
  try {
    const raw = JSON.parse(await readFile(path.resolve(process.cwd(), 'data', 'deal-amounts.json'), 'utf8'));
    const map = {};
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_') && typeof v === 'number') map[k.toLowerCase()] = v;
    return map;
  } catch {
    return {};
  }
}

/** Compact per-deal snapshot for the model to reason over. */
export async function buildPipelineContext() {
  const amounts = await loadAmounts();
  const deals = await listDeals();
  const ctx = [];
  for (const deal of deals) {
    const calls = await getDealCallsWithScores(deal.id);
    const trends = computeTrends(calls);
    const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
    const flags = computeFlags(deal, trends, {
      modelStage: deal.stage,
      competition: { named_competitor: Boolean(compRow?.named_competitor) },
    });
    const scores = {};
    const series = {};
    for (const e of ELEMENTS) {
      scores[e] = trends.latest[e];
      if ((trends.series[e] || []).length > 1) series[e] = trends.series[e];
    }
    ctx.push({
      name: deal.name,
      company: deal.company,
      stage: deal.stage,
      amount: amounts[deal.name.toLowerCase()] ?? null,
      calls: calls.length,
      scores,
      series,
      flags: flags.map((f) => ({ type: f.flag_type, severity: f.severity })),
    });
  }
  return ctx;
}

/** Answer a natural-language question grounded in the current pipeline. */
export async function askPipeline(question) {
  const ctx = await buildPipelineContext();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `PIPELINE DATA (JSON):\n${JSON.stringify(ctx, null, 0)}\n\nQUESTION: ${question}`,
      },
    ],
  });
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    console.error('Usage: node src/ask.js "<question about the pipeline>"');
    process.exit(1);
  }
  askPipeline(question)
    .then((answer) => {
      console.log(`\n❓ ${question}\n`);
      console.log(answer + '\n');
    })
    .catch((err) => {
      console.error('Ask failed:', err.message);
      process.exit(1);
    });
}
