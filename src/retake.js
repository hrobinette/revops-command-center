// Retake helper — un-process a single transcript so it can be dropped again fresh.
//
// The pipeline dedupes by filename, so a transcript can only be demoed once: a second
// drop is skipped and no scorecard or approval buttons appear. That is correct for
// production (idempotency) but hostile to recording a demo, where you want take two.
//
// This rewinds one transcript to "never seen":
//   npm run retake -- Sable_Point_Insurance.txt              (local state only)
//   npm run retake -- Sable_Point_Insurance.txt --hubspot    (also archive the CRM deal)
//
// Local reset alone leaves the deal in HubSpot, so the next approval prompt offers
// "Update: <deal>" instead of "Create". Pass --hubspot to get the Create path back.
import 'dotenv/config';
import { supabase } from './db.js';

const BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_TOKEN;

const args = process.argv.slice(2);
const alsoHubspot = args.includes('--hubspot');
const sourceFile = args.find((a) => !a.startsWith('--'));

if (!sourceFile) {
  console.error('Usage: npm run retake -- <transcript-filename.txt> [--hubspot]');
  process.exit(1);
}

/** Archive a deal in HubSpot (soft delete — recoverable from the portal's recycle bin). */
async function archiveHubspotDeal(id) {
  const res = await fetch(`${BASE}/crm/v3/objects/deals/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
  }
}

const { data: call, error: callErr } = await supabase
  .from('calls')
  .select('id, deal_id, call_number')
  .eq('source_file', sourceFile)
  .maybeSingle();
if (callErr) throw callErr;

if (!call) {
  console.log(`• ${sourceFile} was never processed — nothing to undo. Ready to drop.`);
  process.exit(0);
}

const { data: deal } = await supabase
  .from('deals')
  .select('id, name, hubspot_deal_id')
  .eq('id', call.deal_id)
  .maybeSingle();

// Scores and flags hang off the call; remove them before the call row itself.
for (const table of ['scores', 'flags']) {
  const { error } = await supabase.from(table).delete().eq('call_id', call.id);
  if (error) throw error;
}
const { error: delCallErr } = await supabase.from('calls').delete().eq('id', call.id);
if (delCallErr) throw delCallErr;
console.log(`✓ removed call + scores/flags for ${sourceFile}`);

// Only drop the deal if this was its last call — a multi-call deal must survive.
const { count } = await supabase
  .from('calls')
  .select('id', { count: 'exact', head: true })
  .eq('deal_id', call.deal_id);

if (count === 0 && deal) {
  await supabase.from('flags').delete().eq('deal_id', deal.id);
  await supabase.from('deals').delete().eq('id', deal.id);
  console.log(`✓ removed deal "${deal.name}" (no calls left)`);

  if (alsoHubspot && deal.hubspot_deal_id) {
    if (!TOKEN || TOKEN.includes('REPLACE_ME')) {
      console.log('⚠ --hubspot given but HUBSPOT_TOKEN is not set — skipped CRM cleanup.');
    } else {
      await archiveHubspotDeal(deal.hubspot_deal_id);
      console.log(`✓ archived HubSpot deal ${deal.hubspot_deal_id} — the Create path will show again`);
    }
  } else if (deal.hubspot_deal_id) {
    console.log(
      `• HubSpot deal ${deal.hubspot_deal_id} left in place — the next prompt will offer "Update: ${deal.name}".\n` +
        `  Re-run with --hubspot to archive it and demo the Create path instead.`
    );
  }
} else if (count > 0) {
  console.log(`• deal "${deal?.name}" kept — it still has ${count} other call(s)`);
}

console.log(`\n${sourceFile} is ready to drop again.`);
