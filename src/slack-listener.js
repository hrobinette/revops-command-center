// Slack drag-and-drop ingestion (Week 9) + human-in-the-loop CRM writeback.
// Listens over Socket Mode for transcript files dropped into the channel, saves them
// to transcripts/, scores them, replies with the scorecard, then ASKS before writing
// anything to HubSpot: it fuzzy-matches the deal name and posts approval buttons.
// Nothing hits the CRM until a human clicks. A long-running service (not a timer).
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import bolt from '@slack/bolt';
import { runPipeline } from './process.js';
import { postDealCard } from './slack.js';
import {
  hubspotEnabled,
  searchDealsByName,
  createDeal,
  writeNoteToDeal,
  buildNoteBody,
} from './hubspot.js';
import { setDealHubspotId } from './db.js';

const { App } = bolt;
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const APP_TOKEN = process.env.SLACK_APP_TOKEN;
const TRANSCRIPT_DIR = path.resolve(process.cwd(), 'transcripts');
const TEXT = /\.(txt|md|markdown)$/i;

if (!BOT_TOKEN || BOT_TOKEN.includes('REPLACE_ME')) {
  throw new Error('SLACK_BOT_TOKEN missing in .env');
}
if (!APP_TOKEN || APP_TOKEN.includes('REPLACE_ME')) {
  throw new Error('SLACK_APP_TOKEN (xapp-...) missing — enable Socket Mode and add an app-level token');
}

const app = new App({ token: BOT_TOKEN, appToken: APP_TOKEN, socketMode: true });

// Pending CRM writes awaiting a human click, keyed by a short token that rides in
// the button value. In-memory: a listener restart drops these (the click then
// reports "expired" and the rep re-drops the file). Note bodies stay here, not in
// the button value, so values stay well under Slack's size limit.
const pending = new Map();
const MAX_CANDIDATE_BUTTONS = 3; // Slack actions blocks cap at 5 elements; leave room for Create + Skip

function safeName(name) {
  const base = path.basename(name || 'transcript.txt').replace(/[^\w.\-]/g, '_');
  return TEXT.test(base) ? base : `${base}.txt`;
}

/** Build the approval message asking whether to create or update a HubSpot deal. */
function approvalBlocks({ token, dealName, candidates }) {
  const buttons = [];
  for (const c of candidates.slice(0, MAX_CANDIDATE_BUTTONS)) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: `Update: ${c.name}`.slice(0, 75), emoji: true },
      value: JSON.stringify({ t: token, a: 'update', h: c.id }),
      action_id: `hs_decision_update_${c.id}`,
    });
  }
  buttons.push({
    type: 'button',
    style: 'primary',
    text: { type: 'plain_text', text: candidates.length ? 'Create new instead' : `Create "${dealName}"`.slice(0, 75), emoji: true },
    value: JSON.stringify({ t: token, a: 'create' }),
    action_id: 'hs_decision_create',
  });
  buttons.push({
    type: 'button',
    text: { type: 'plain_text', text: 'Skip', emoji: true },
    value: JSON.stringify({ t: token, a: 'skip' }),
    action_id: 'hs_decision_skip',
  });

  const prompt = candidates.length
    ? `🔗 *HubSpot* — found ${candidates.length} possible match${candidates.length > 1 ? 'es' : ''} for *${dealName}*. Update an existing deal with this call's MEDDPICC note, or create a new one?`
    : `🔗 *HubSpot* — no existing deal matches *${dealName}*. Create a new deal and attach this call's MEDDPICC note?`;

  return [
    { type: 'section', text: { type: 'mrkdwn', text: prompt } },
    { type: 'actions', elements: buttons },
  ];
}

/**
 * Core ingestion: score an already-saved transcript, post the scorecard, then
 * fuzzy-match HubSpot and post the approval buttons. Writes nothing to HubSpot
 * until a human clicks an approval button.
 */
async function handleTranscript({ savedName, channel, client }) {
  const { deals } = await runPipeline({ only: savedName, pushHubspot: false, notifySlack: false, quiet: true });
  if (!deals.length) {
    if (channel) {
      await client.chat.postMessage({ channel, text: `⚠️ Couldn't score *${savedName}* — is it a call transcript with a \`Deal:\` header?` });
    }
    return;
  }
  const { deal, trends, flags, summary, resolved } = deals[0];
  await postDealCard(deal, trends, flags, resolved);

  // Human-in-the-loop CRM step: match, then ask before writing.
  if (!hubspotEnabled()) {
    if (channel) {
      await client.chat.postMessage({ channel, text: '🔗 HubSpot not configured — scored and saved, nothing to sync.' });
    }
    return;
  }

  let candidates = [];
  try {
    candidates = await searchDealsByName(deal.name);
  } catch (err) {
    if (channel) {
      await client.chat.postMessage({ channel, text: `⚠️ HubSpot lookup failed: ${err.message}. Scored and saved; skipping CRM writeback.` });
    }
    return;
  }

  // Stash everything the button click needs; keep the note body server-side.
  const token = randomUUID().slice(0, 8);
  const noteBody = buildNoteBody({ deal, trends, flags, summary, resolved });
  pending.set(token, { dealName: deal.name, dealId: deal.id, noteBody, candidates });

  if (channel) {
    await client.chat.postMessage({
      channel,
      text: `Approve HubSpot writeback for ${deal.name}?`,
      blocks: approvalBlocks({ token, dealName: deal.name, candidates }),
    });
  }
}

app.event('file_shared', async ({ event, client }) => {
  const channel = event.channel_id;
  try {
    const { file } = await client.files.info({ file: event.file_id });
    const name = file?.name || '';
    const isText = TEXT.test(name) || (file?.mimetype || '').startsWith('text/');
    if (!isText) {
      if (channel) {
        await client.chat.postMessage({ channel, text: `Skipped *${name}* — I only score text transcripts (.txt or .md).` });
      }
      return;
    }

    // Download the file with the bot token, save into transcripts/.
    const res = await fetch(file.url_private_download || file.url_private, {
      headers: { Authorization: `Bearer ${BOT_TOKEN}` },
    });
    const text = await res.text();
    const dest = safeName(name);
    await writeFile(path.join(TRANSCRIPT_DIR, dest), text, 'utf8');
    if (channel) {
      await client.chat.postMessage({ channel, text: `📥 Got *${dest}* — scoring now…` });
    }

    await handleTranscript({ savedName: dest, channel, client });
  } catch (err) {
    console.error('ingest error:', err.message);
    if (channel) {
      try {
        await client.chat.postMessage({ channel, text: `⚠️ Ingest error: ${err.message}` });
      } catch {
        /* ignore secondary failure */
      }
    }
  }
});

// Handle the approval buttons. One handler for all three actions (create/update/skip);
// the choice rides in the button value alongside the pending-write token.
app.action(/^hs_decision_/, async ({ ack, body, client, action }) => {
  await ack();
  const chan = body.channel?.id;
  const ts = body.message?.ts;
  const replace = async (text) => {
    if (chan && ts) {
      await client.chat.update({ channel: chan, ts, text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] });
    }
  };

  let choice;
  try {
    choice = JSON.parse(action.value);
  } catch {
    await replace('⚠️ Could not read that button. Please re-drop the transcript.');
    return;
  }

  const job = pending.get(choice.t);
  if (!job) {
    await replace('⌛ This approval expired (the listener restarted). Re-drop the transcript to try again.');
    return;
  }

  const who = body.user?.name || body.user?.id || 'someone';
  try {
    if (choice.a === 'skip') {
      pending.delete(choice.t);
      await replace(`⏭️ *${job.dealName}* — skipped by ${who}. Nothing written to HubSpot.`);
      return;
    }

    let hsId;
    let verb;
    if (choice.a === 'create') {
      hsId = await createDeal({ name: job.dealName });
      verb = 'Created new deal';
    } else if (choice.a === 'update') {
      hsId = choice.h;
      verb = 'Updated existing deal';
    } else {
      await replace('⚠️ Unknown action.');
      return;
    }

    await setDealHubspotId(job.dealId, hsId);
    await writeNoteToDeal({ dealId: hsId, body: job.noteBody });
    pending.delete(choice.t);
    await replace(`✅ *${job.dealName}* — ${verb} and wrote the MEDDPICC note to HubSpot (approved by ${who}).`);
  } catch (err) {
    console.error('writeback error:', err.message);
    await replace(`⚠️ *${job.dealName}* — HubSpot write failed: ${err.message}. Nothing was saved; try again.`);
  }
});

await app.start();
console.log('⚡ RevOps Slack listener running (Socket Mode). Drop a .txt/.md transcript to score it; I ask before writing to HubSpot.');
