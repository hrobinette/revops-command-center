// Annual contract value (USD) per deal, for the risk-adjusted forecast.
// Mirrors ../../data/deal-amounts.json — kept as a JS module here because the
// Vercel deployment's root is dashboard/, so it can't read the repo-root JSON
// at runtime. In production both would be replaced by the CRM's amount field.
export const AMOUNTS = {
  'Lakeshore Fintech': 120000,
  'Harbor Health Systems': 85000,
  'Trellis Logistics': 70000,
  'Bluepine Retail': 40000,
  'NovaWorks': 55000,
  'Corvid Manufacturing': 95000,
  'Cedarhill Robotics': 60000,
};
