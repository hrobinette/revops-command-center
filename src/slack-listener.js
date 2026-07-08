// Slack drag-and-drop ingestion (Week 9).
// Listens over Socket Mode for transcript files dropped into the channel, saves them
// to transcripts/, runs the pipeline, and replies with the scorecard — no terminal,
// no folder access needed. A long-running service (not a timer).
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import bolt from '@slack/bolt';
import { runPipeline } from './process.js';
import { postDealCard } from './slack.js';

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

function safeName(name) {
  const base = path.basename(name || 'transcript.txt').replace(/[^\w.\-]/g, '_');
  return TEXT.test(base) ? base : `${base}.txt`;
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

    // Score just this file, sync HubSpot; reply with the scorecard ourselves.
    const { deals } = await runPipeline({ only: dest, pushHubspot: true, notifySlack: false, quiet: true });
    if (!deals.length) {
      if (channel) {
        await client.chat.postMessage({ channel, text: `⚠️ Couldn't score *${dest}* — is it a call transcript with a \`Deal:\` header?` });
      }
      return;
    }
    const { deal, trends, flags } = deals[0];
    await postDealCard(deal, trends, flags);
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

await app.start();
console.log('⚡ RevOps Slack listener running (Socket Mode). Drop a .txt/.md transcript into the channel to score it.');
