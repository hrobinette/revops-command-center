// Main pipeline + CLI. Ingest -> score -> store -> trends -> flags -> summary table.
import 'dotenv/config';
import {
  getOrCreateDeal,
  isFileProcessed,
  insertCall,
  insertScores,
  insertFlags,
  clearFlagsForDeal,
  getDealCallsWithScores,
  setDealHubspotId,
  resetAll,
} from './db.js';
import { listTranscriptFiles, readTranscript } from './ingest.js';
import { scoreTranscript } from './score.js';
import { computeTrends } from './trends.js';
import { computeFlags } from './flags.js';
import { ELEMENTS } from './prompts/meddpicc.js';
import { hubspotEnabled, upsertDeal, writeNoteToDeal, buildNoteBody } from './hubspot.js';
import { slackEnabled, postDigest, postAlert } from './slack.js';

const ABBR = {
  metrics: 'M',
  economic_buyer: 'EB',
  decision_criteria: 'DC',
  decision_process: 'DP',
  paper_process: 'PP',
  identify_pain: 'IP',
  champion: 'CH',
  competition: 'CO',
};

function parseArgs(argv) {
  const opts = { all: false, only: null, limit: null, pushHubspot: false, notifySlack: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a === '--push-hubspot') opts.pushHubspot = true;
    else if (a === '--notify-slack') opts.notifySlack = true;
  }
  return opts;
}

/**
 * Run the pipeline. Returns { deals: [{deal, trends, flags}] } for the touched deals.
 * @param opts { all, only, limit, quiet }
 */
export async function runPipeline(opts = {}) {
  if (opts.all) {
    if (!opts.quiet) console.log('↻ --all: clearing all rows and reprocessing every transcript.');
    await resetAll();
  }

  let files = await listTranscriptFiles();
  if (opts.only) files = files.filter((f) => f.includes(opts.only));
  if (opts.limit) files = files.slice(0, opts.limit);

  if (!files.length) {
    if (!opts.quiet) console.log('No transcripts found in ./transcripts/ (need *.txt files).');
    return { deals: [] };
  }

  const pushHubspot = opts.pushHubspot && hubspotEnabled();
  if (opts.pushHubspot && !hubspotEnabled() && !opts.quiet) {
    console.log('⚠ --push-hubspot given but HUBSPOT_TOKEN is not set — skipping CRM writeback.');
  }

  const touched = new Map(); // dealId -> deal row
  const summaries = new Map(); // dealId -> { callNumber, summary } (latest call wins)

  for (const file of files) {
    if (!opts.all && (await isFileProcessed(file))) {
      if (!opts.quiet) console.log(`• skip (already processed): ${file}`);
      continue;
    }

    try {
      const parsed = await readTranscript(file);
      if (!opts.quiet) console.log(`→ scoring ${file} (${parsed.deal_name}, call ${parsed.call_number})`);

      const scored = await scoreTranscript({
        dealName: parsed.deal_name,
        stage: parsed.stage,
        callNumber: parsed.call_number,
        callDate: parsed.call_date,
        attendees: parsed.attendees,
        transcript: parsed.transcript,
      });

      const effectiveStage = parsed.stage || scored.stage_assessment || null;
      const deal = await getOrCreateDeal({
        name: parsed.deal_name,
        company: parsed.company,
        stage: effectiveStage,
      });

      const call = await insertCall({
        deal_id: deal.id,
        source_file: parsed.source_file,
        call_number: parsed.call_number,
        call_date: parsed.call_date,
        attendees: parsed.attendees,
        transcript: parsed.transcript,
      });

      const scoreRows = ELEMENTS.map((el) => {
        const e = scored.elements[el];
        return {
          call_id: call.id,
          deal_id: deal.id,
          element: el,
          score: e.score,
          confidence: e.confidence,
          evidence: e.evidence,
          named_competitor: el === 'competition' ? Boolean(e.named_competitor) : null,
        };
      });
      await insertScores(scoreRows);

      touched.set(deal.id, deal);
      // keep the latest-call summary per deal for the HubSpot note
      const prevSummary = summaries.get(deal.id);
      if (!prevSummary || parsed.call_number >= prevSummary.callNumber) {
        summaries.set(deal.id, { callNumber: parsed.call_number, summary: scored.summary });
      }
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
    }
  }

  // Recompute trends + flags for every deal we touched this run.
  const results = [];
  for (const [dealId, deal] of touched) {
    const calls = await getDealCallsWithScores(dealId);
    const trends = computeTrends(calls);

    const compRow = (trends.latestCall?.scores || []).find((s) => s.element === 'competition');
    const ctx = {
      modelStage: deal.stage,
      competition: { named_competitor: Boolean(compRow?.named_competitor) },
    };

    const flags = computeFlags(deal, trends, ctx);
    await clearFlagsForDeal(dealId);
    await insertFlags(flags);

    if (pushHubspot) {
      try {
        const hsId = await upsertDeal({ name: deal.name });
        await setDealHubspotId(dealId, hsId);
        const summary = summaries.get(dealId)?.summary || '';
        const body = buildNoteBody({ deal, trends, flags, summary });
        await writeNoteToDeal({ dealId: hsId, body });
        if (!opts.quiet) console.log(`   ↳ HubSpot: deal ${hsId} — note written (${flags.length} flag(s))`);
      } catch (err) {
        console.error(`   ✗ HubSpot push failed for ${deal.name}: ${err.message}`);
      }
    }

    results.push({ deal, trends, flags });
  }

  // Slack delivery: per-deal alerts for red flags + a health digest of everything.
  if (opts.notifySlack && !slackEnabled() && !opts.quiet) {
    console.log('⚠ --notify-slack given but SLACK_BOT_TOKEN/SLACK_CHANNEL not set — skipping Slack.');
  }
  if (opts.notifySlack && slackEnabled() && results.length) {
    try {
      for (const { deal, flags } of results) {
        if (flags.some((f) => f.severity === 'red')) {
          await postAlert(deal, flags);
          if (!opts.quiet) console.log(`   ↳ Slack alert: ${deal.name}`);
        }
      }
      await postDigest(results);
      if (!opts.quiet) console.log('   ↳ Slack digest posted');
    } catch (err) {
      console.error(`   ✗ Slack notify failed: ${err.message}`);
    }
  }

  if (!opts.quiet) printSummary(results);
  return { deals: results };
}

function printSummary(results) {
  if (!results.length) {
    console.log('\nNothing new to report.\n');
    return;
  }
  const header = ['Deal', 'Stage', ...ELEMENTS.map((e) => ABBR[e]), 'Flags'];
  const rows = results
    .sort((a, b) => a.deal.name.localeCompare(b.deal.name))
    .map(({ deal, trends, flags }) => {
      const cells = ELEMENTS.map((e) => {
        const v = trends.latest[e];
        return v == null ? '-' : String(v);
      });
      const flagStr = flags.length
        ? flags.map((f) => `${f.severity === 'red' ? '🔴' : '🟡'} ${f.flag_type}`).join(', ')
        : '✓ clean';
      return [deal.name, deal.stage || '?', ...cells, flagStr];
    });

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const fmt = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join('  ');

  console.log('\n' + fmt(header));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) console.log(fmt(r));
  console.log('\nLegend: ' + ELEMENTS.map((e) => `${ABBR[e]}=${e}`).join('  ') + '\n');
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = parseArgs(process.argv.slice(2));
  runPipeline(opts).catch((err) => {
    console.error('\nPipeline failed:', err.message);
    process.exit(1);
  });
}
