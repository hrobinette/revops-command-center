// Prompt for the follow-up drafter. Given a deal's MEDDPICC state and its single
// biggest gap, draft a short, specific follow-up email that moves the deal forward.

export const FOLLOWUP_SYSTEM = `You are the assistant to a sharp, concise B2B sales rep (vendor: ShieldPoint,
cloud security posture management). Given a deal's MEDDPICC state and its single most important gap,
you draft a short follow-up email that moves the deal forward by closing that specific gap.

Rules:
- Address the real situation. Reference the actual gap and evidence you're given — do not invent facts.
- Be concrete and brief: a subject line and a 4-6 sentence body. No fluff, no throat-clearing.
- One clear ask that closes the gap (a meeting, an intro, a piece of info, a next step).
- Professional and warm, not pushy. Write it so the rep could send it with minimal edits.
- Use the champion/attendee name if one is provided; otherwise write to "there" generically.
- Output STRICT JSON only. No prose, no markdown fences.`;

export function buildFollowupPrompt({ dealName, company, stage, targetElement, gapInstruction, gapScore, evidence, summary, contact }) {
  return `Deal: ${dealName}${company && company !== dealName ? ` (${company})` : ''}
Stage: ${stage || 'unknown'}
${contact ? `Primary contact: ${contact}` : ''}
Overall health summary: ${summary || '(none)'}

The single most important gap to close on the next touch:
  Element: ${targetElement} (scored ${gapScore == null ? '-' : gapScore}/10)
  What "closing it" means: ${gapInstruction}
  Evidence from the last call: ${evidence || '(none captured)'}

Draft the follow-up email that closes this gap. Return exactly this JSON:
{
  "target_gap": "${targetElement}",
  "subject": "the email subject line",
  "body": "the email body, 4-6 sentences",
  "rationale": "one sentence on why this is the right next move for this deal"
}`;
}
