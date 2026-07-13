// Human-readable flag names for the UI (no raw UPPER_SNAKE_CASE on screen).
export const FLAG_LABEL = {
  NO_EB_LATE_STAGE: 'No economic buyer (late stage)',
  CHAMPION_DECLINE: 'Champion declining',
  NO_PAPER_PROCESS_LATE: 'No paper process (late stage)',
  UNQUALIFIED: 'Unqualified',
  COMPETITIVE_EXPOSURE: 'Competitive exposure',
};

// Fallback: any unmapped flag renders with underscores turned into spaces.
export const flagLabel = (t) => FLAG_LABEL[t] || String(t || '').replace(/_/g, ' ');

// The element whose evidence best explains each flag (for surfacing the transcript quote).
export const FLAG_ELEMENT = {
  NO_EB_LATE_STAGE: 'economic_buyer',
  CHAMPION_DECLINE: 'champion',
  NO_PAPER_PROCESS_LATE: 'paper_process',
  UNQUALIFIED: 'identify_pain',
  COMPETITIVE_EXPOSURE: 'competition',
};

// Prescriptive next step per flag — grounded in MEDDPICC best practice.
export const RECOMMENDATION = {
  NO_EB_LATE_STAGE:
    'Get the economic buyer on the next call before advancing — a proposal that never reaches the budget owner stalls.',
  CHAMPION_DECLINE:
    'Your champion is disengaging. Re-establish value and multithread to a second stakeholder before the deal goes dark.',
  NO_PAPER_PROCESS_LATE:
    'Map the procurement, legal, and security review now — an unknown paper process at this stage slips the close date.',
  UNQUALIFIED:
    'Quantify the cost of inaction and confirm a real, owned pain before investing more cycles — this deal isn’t qualified yet.',
  COMPETITIVE_EXPOSURE:
    'A named competitor is in play and the criteria aren’t set. Shape the decision criteria around your strengths before the demo.',
};
