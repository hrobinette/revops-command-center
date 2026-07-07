// Ingestion: read ./transcripts/*.txt, parse the metadata header + body.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const TRANSCRIPT_DIR = path.resolve(process.cwd(), 'transcripts');

const HEADER_KEYS = new Set(['deal', 'company', 'stage', 'call', 'date', 'attendees']);

/** List transcript files (.txt only; README and dotfiles ignored). */
export async function listTranscriptFiles() {
  let entries;
  try {
    entries = await readdir(TRANSCRIPT_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.toLowerCase().endsWith('.txt') && !f.startsWith('.'))
    .sort();
}

function callNumberFromFilename(filename) {
  const m = filename.match(/(\d+)(?=\.[^.]+$)/); // trailing number before extension
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Parse one transcript file into structured form.
 * Header is the leading run of "Key: value" lines, terminated by a `---` fence
 * or the first blank line. Everything after is the transcript body.
 */
export function parseTranscript(filename, contents) {
  const lines = contents.replace(/\r\n/g, '\n').split('\n');
  const header = {};
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      bodyStart = i + 1;
      break;
    }
    if (line.trim() === '') {
      bodyStart = i + 1;
      break;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      // Not a header line — treat everything from here as body.
      bodyStart = i;
      break;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (HEADER_KEYS.has(key)) {
      header[key] = value;
    } else {
      // Unknown key before any blank line: assume header ended.
      bodyStart = i;
      break;
    }
  }

  const transcript = lines.slice(bodyStart).join('\n').trim();

  if (!header.deal) {
    throw new Error(`${filename}: missing required "Deal:" header`);
  }

  const stage = (header.stage || '').toLowerCase() || null;
  const attendees = header.attendees
    ? header.attendees.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  return {
    source_file: filename,
    deal_name: header.deal,
    company: header.company || header.deal,
    stage,
    call_number: header.call ? parseInt(header.call, 10) : callNumberFromFilename(filename) || 1,
    call_date: header.date || null,
    attendees,
    transcript,
  };
}

export async function readTranscript(filename) {
  const full = path.join(TRANSCRIPT_DIR, filename);
  const contents = await readFile(full, 'utf8');
  return parseTranscript(filename, contents);
}
