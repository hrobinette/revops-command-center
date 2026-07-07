// Scoring engine: one Anthropic API call per transcript -> validated JSON.
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt, ELEMENTS } from './prompts/meddpicc.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey.includes('REPLACE_ME')) {
  throw new Error('Missing ANTHROPIC_API_KEY. Fill it in .env (see .env.example).');
}

const client = new Anthropic({ apiKey });
const MODEL = process.env.MEDDPICC_MODEL || 'claude-sonnet-5';

const ALIASES = {
  economic_buyer: 'economic_buyer',
  economicbuyer: 'economic_buyer',
  eb: 'economic_buyer',
  decision_criteria: 'decision_criteria',
  decisioncriteria: 'decision_criteria',
  decision_process: 'decision_process',
  decisionprocess: 'decision_process',
  paper_process: 'paper_process',
  paperprocess: 'paper_process',
  identify_pain: 'identify_pain',
  identifypain: 'identify_pain',
  pain: 'identify_pain',
  metrics: 'metrics',
  champion: 'champion',
  competition: 'competition',
};

function canonicalElement(name) {
  const key = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  return ALIASES[key] || ALIASES[String(name || '').toLowerCase()] || null;
}

/** Pull the JSON object out of a model response, tolerating stray fences/text. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(candidate.slice(start, end + 1));
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

/**
 * Score one transcript. Returns:
 *   { stage_assessment, summary, elements: { <element>: { score, confidence, evidence, named_competitor } } }
 */
export async function scoreTranscript(meta) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(meta) }],
  });

  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const raw = extractJson(text);

  const elements = {};
  for (const el of raw.elements || []) {
    const canon = canonicalElement(el.element);
    if (!canon) continue;
    elements[canon] = {
      score: clampScore(el.score),
      confidence: ['high', 'medium', 'low'].includes(el.confidence) ? el.confidence : 'low',
      evidence: (el.evidence || '').slice(0, 500),
      named_competitor: canon === 'competition' ? Boolean(el.named_competitor) : undefined,
    };
  }

  const missing = ELEMENTS.filter((e) => !(e in elements));
  if (missing.length) {
    throw new Error(`Scoring response missing elements: ${missing.join(', ')}`);
  }

  return {
    stage_assessment: raw.stage_assessment || null,
    summary: raw.summary || '',
    elements,
  };
}
