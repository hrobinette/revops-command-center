// Ingestion: read ./transcripts/*.{txt,md}, parse the metadata header + body.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const TRANSCRIPT_DIR = path.resolve(process.cwd(), 'transcripts');

const HEADER_KEYS = new Set(['deal', 'company', 'stage', 'call', 'date', 'attendees']);

// Files that live in transcripts/ but must never be treated as a transcript.
const NON_TRANSCRIPT = /^readme|answer[_-]?key|^00_/i;

/** List transcript files (.txt and .md; dotfiles, README, and answer keys ignored). */
export async function listTranscriptFiles() {
  let entries;
  try {
    entries = await readdir(TRANSCRIPT_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => /\.(txt|md)$/i.test(f) && !f.startsWith('.') && !NON_TRANSCRIPT.test(f))
    .sort();
}

function callNumberFromFilename(filename) {
  const m = filename.match(/(\d+)(?=\.[^.]+$)/); // trailing number before extension
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Map a free-text stage descriptor (e.g. the "Call:" line "2 of 2 — Proposal Review")
 * to a canonical pipeline stage. Order matters: later stages are checked first so
 * "Proposal Review" resolves to proposal, not evaluation.
 */
export function stageFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/negotiat|redline|contract|signature|closing|close/.test(t)) return 'negotiation';
  if (/proposal|pricing|quote|procurement|\bpaper\b/.test(t)) return 'proposal';
  if (/demo|trial|technical|eval|poc|checkpoint|review/.test(t)) return 'evaluation';
  if (/discovery|intro|introduction|qualif|kickoff/.test(t)) return 'discovery';
  return null;
}

/**
 * Parse one transcript file into structured form. The header is everything before the
 * first standalone `---` line (or, absent a fence, the leading run before the first blank
 * line). Within the header, any recognized "Key: value" line is collected; unknown lines
 * (a title like "CALL TRANSCRIPT", or a "Duration:" field) are ignored.
 */
export function parseTranscript(filename, contents) {
  const lines = contents.replace(/\r\n/g, '\n').split('\n');

  const fenceIdx = lines.findIndex((l) => l.trim() === '---');
  let headerLines;
  let bodyLines;
  if (fenceIdx !== -1) {
    headerLines = lines.slice(0, fenceIdx);
    bodyLines = lines.slice(fenceIdx + 1);
  } else {
    const blankIdx = lines.findIndex((l) => l.trim() === '');
    const cut = blankIdx === -1 ? lines.length : blankIdx;
    headerLines = lines.slice(0, cut);
    bodyLines = lines.slice(cut);
  }

  const header = {};
  for (const line of headerLines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue; // title lines, separators, etc.
    const key = line.slice(0, idx).trim().toLowerCase();
    if (HEADER_KEYS.has(key)) header[key] = line.slice(idx + 1).trim();
  }

  if (!header.deal) {
    throw new Error(`${filename}: missing required "Deal:" header`);
  }

  const transcript = bodyLines.join('\n').trim();

  // stage: explicit "Stage:" wins; else infer from the "Call:" descriptor;
  // else null -> the scoring model's stage_assessment is used downstream.
  let stage = (header.stage || '').toLowerCase() || null;
  if (!stage && header.call) stage = stageFromText(header.call);

  // Split on commas that are NOT inside parentheses, so "Dana (ShieldPoint, AE)"
  // stays a single attendee rather than splitting on the role comma.
  const attendees = header.attendees
    ? header.attendees.split(/,(?![^(]*\))/).map((a) => a.trim()).filter(Boolean)
    : [];

  const call_number =
    (header.call && parseInt(header.call, 10)) || callNumberFromFilename(filename) || 1;

  return {
    source_file: filename,
    deal_name: header.deal,
    company: header.company || header.deal,
    stage,
    call_number,
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
