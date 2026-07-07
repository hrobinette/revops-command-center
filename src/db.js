// Supabase state layer. All DB access goes through here.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key || url.includes('REPLACE_ME') || key.includes('REPLACE_ME')) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Fill them in .env (see .env.example).'
  );
}

export const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Insert the deal if new, otherwise return the existing row. Keeps stage fresh. */
export async function getOrCreateDeal({ name, company, stage }) {
  const { data: existing, error: selErr } = await supabase
    .from('deals')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    // Advance stage if the newer call reports a later stage.
    if (stage && stage !== existing.stage) {
      const { data: updated, error: updErr } = await supabase
        .from('deals')
        .update({ stage })
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      return updated;
    }
    return existing;
  }

  const { data: created, error: insErr } = await supabase
    .from('deals')
    .insert({ name, company: company || name, stage })
    .select()
    .single();
  if (insErr) throw insErr;
  return created;
}

/** Idempotency check: has this transcript file already been ingested? */
export async function isFileProcessed(sourceFile) {
  const { data, error } = await supabase
    .from('calls')
    .select('id')
    .eq('source_file', sourceFile)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertCall(call) {
  const { data, error } = await supabase.from('calls').insert(call).select().single();
  if (error) throw error;
  return data;
}

export async function insertScores(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from('scores').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function insertFlags(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from('flags').insert(rows).select();
  if (error) throw error;
  return data;
}

/** All calls for a deal, oldest first, with their scores attached. */
export async function getDealCallsWithScores(dealId) {
  const { data: calls, error: callErr } = await supabase
    .from('calls')
    .select('*')
    .eq('deal_id', dealId)
    .order('call_number', { ascending: true });
  if (callErr) throw callErr;

  const { data: scores, error: scoreErr } = await supabase
    .from('scores')
    .select('*')
    .eq('deal_id', dealId);
  if (scoreErr) throw scoreErr;

  return calls.map((c) => ({
    ...c,
    scores: scores.filter((s) => s.call_id === c.id),
  }));
}

export async function listDeals() {
  const { data, error } = await supabase.from('deals').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getFlagsForDeal(dealId) {
  const { data, error } = await supabase.from('flags').select('*').eq('deal_id', dealId);
  if (error) throw error;
  return data;
}

/** Wipe flags for a deal before recomputing (flags are derived, not accumulated). */
export async function clearFlagsForDeal(dealId) {
  const { error } = await supabase.from('flags').delete().eq('deal_id', dealId);
  if (error) throw error;
}

/** Full reset for `--all`. Order respects FK cascade but we delete explicitly. */
export async function resetAll() {
  for (const table of ['flags', 'scores', 'calls', 'deals']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
}
