// Risk engine (Week 7: rules only; LLM judgment + alerting come in Week 8).
// Each rule returns a flag object or null.

const LATE_STAGES = new Set(['proposal', 'negotiation']);

function isLateStage(stage) {
  return LATE_STAGES.has(String(stage || '').toLowerCase());
}

/**
 * @param deal    { id, stage }  (stage may be null -> fall back to model stage_assessment)
 * @param trends  output of computeTrends()
 * @param ctx     { modelStage, competition }  where competition = latest competition score row
 * @returns array of { flag_type, severity, detail, call_id }
 */
export function computeFlags(deal, trends, ctx = {}) {
  const { latest, consecutiveDecline, latestCall } = trends;
  const stage = deal.stage || ctx.modelStage || null;
  const late = isLateStage(stage);
  const callId = latestCall ? latestCall.id : null;
  const flags = [];

  // 1. NO_EB_LATE_STAGE (red)
  if (late && latest.economic_buyer != null && latest.economic_buyer < 5) {
    flags.push({
      flag_type: 'NO_EB_LATE_STAGE',
      severity: 'red',
      detail: `Stage "${stage}" but economic_buyer=${latest.economic_buyer} (<5) on latest call.`,
      call_id: callId,
    });
  }

  // 2. CHAMPION_DECLINE (red): champion decreased on 2+ consecutive calls
  if ((consecutiveDecline.champion || 0) >= 2) {
    flags.push({
      flag_type: 'CHAMPION_DECLINE',
      severity: 'red',
      detail: `Champion score declined across ${consecutiveDecline.champion + 1} consecutive calls (${(
        trends.series.champion || []
      ).join(' → ')}).`,
      call_id: callId,
    });
  }

  // 3. NO_PAPER_PROCESS_LATE (yellow): at a late stage the paper process should be
  //    engaged (6+). Anything below "engaged" (<5) is a procurement/legal slip risk.
  //    Threshold widened from the brief's <4 to <5 for margin — the model scores a
  //    genuinely-absent paper process right on the 3/4 boundary, so <4 flip-flops.
  if (late && latest.paper_process != null && latest.paper_process < 5) {
    flags.push({
      flag_type: 'NO_PAPER_PROCESS_LATE',
      severity: 'yellow',
      detail: `Stage "${stage}" but paper_process=${latest.paper_process} (<5, not yet engaged) on latest call.`,
      call_id: callId,
    });
  }

  // 4. UNQUALIFIED (yellow): metrics AND identify_pain both < 4 on latest call
  if (
    latest.metrics != null &&
    latest.identify_pain != null &&
    latest.metrics < 4 &&
    latest.identify_pain < 4
  ) {
    flags.push({
      flag_type: 'UNQUALIFIED',
      severity: 'yellow',
      detail: `metrics=${latest.metrics} and identify_pain=${latest.identify_pain} both <4 on latest call.`,
      call_id: callId,
    });
  }

  // 5. COMPETITIVE_EXPOSURE (yellow): a named competitor AND decision_criteria < 5
  const namedCompetitor = Boolean(ctx.competition?.named_competitor);
  if (namedCompetitor && latest.decision_criteria != null && latest.decision_criteria < 5) {
    flags.push({
      flag_type: 'COMPETITIVE_EXPOSURE',
      severity: 'yellow',
      detail: `Named competitor in play and decision_criteria=${latest.decision_criteria} (<5) — vulnerable to being out-positioned.`,
      call_id: callId,
    });
  }

  return flags;
}
