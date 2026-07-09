import { ELEMENTS, LABELS } from '../lib/data';

export const HEALTH_COLOR = { critical: 'var(--critical)', warning: 'var(--warning)', good: 'var(--good)' };

const SHORT = {
  NO_EB_LATE_STAGE: 'NO EB',
  NO_PAPER_PROCESS_LATE: 'PAPER',
  CHAMPION_DECLINE: 'CHAMPION ↓',
  UNQUALIFIED: 'UNQUALIFIED',
  COMPETITIVE_EXPOSURE: 'COMPETITIVE',
};

export function FlagPills({ flags }) {
  if (!flags.length) return <span className="pill ok">✓ clean</span>;
  return (
    <>
      {flags.map((f, i) => (
        <span key={i} className={`pill ${f.severity === 'red' ? 'red' : 'yel'}`}>
          {SHORT[f.flag_type] || f.flag_type}
        </span>
      ))}
    </>
  );
}

/** Single-series line chart of a score (0–10) across calls. */
export function TrendChart({ series, color = 'var(--critical)', height = 210 }) {
  const W = 400;
  const H = height;
  const padL = 44;
  const padR = 26;
  const padT = 20;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (s) => padT + (1 - s / 10) * plotH;
  const coords = series.map((p, i) => ({ ...p, cx: x(i), cy: p.score == null ? null : y(p.score) }));
  const drawn = coords.filter((c) => c.cy != null);
  const line = drawn.map((c) => `${c.cx},${c.cy}`).join(' ');
  const area = drawn.length
    ? `M${drawn[0].cx},${drawn[0].cy} ` +
      drawn.slice(1).map((c) => `L${c.cx},${c.cy}`).join(' ') +
      ` L${drawn[drawn.length - 1].cx},${padT + plotH} L${drawn[0].cx},${padT + plotH} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Score across calls">
      <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="var(--grid)" strokeWidth="1" />
      <line x1={padL} y1={padT + plotH / 2} x2={W - padR} y2={padT + plotH / 2} stroke="var(--grid)" strokeWidth="1" />
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--baseline)" strokeWidth="1" />
      <text x={padL - 8} y={padT + 4} textAnchor="end" fontSize="10" fill="var(--muted)">10</text>
      <text x={padL - 8} y={padT + plotH / 2 + 4} textAnchor="end" fontSize="10" fill="var(--muted)">5</text>
      <text x={padL - 8} y={padT + plotH + 4} textAnchor="end" fontSize="10" fill="var(--muted)">0</text>
      {area && <path d={area} fill={color} fillOpacity="0.08" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) =>
        c.cy == null ? null : (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r="4.5" fill="var(--surface)" stroke={color} strokeWidth="2.5">
              <title>{`Call ${c.call}: ${c.score}/10`}</title>
            </circle>
            <text x={c.cx} y={c.cy - 11} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">
              {c.score}
            </text>
          </g>
        )
      )}
      {coords.map((c, i) => (
        <text key={`x${i}`} x={c.cx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
          Call {c.call}
        </text>
      ))}
    </svg>
  );
}

/** Horizontal MEDDPICC bars (0–10) for one call's scores. */
export function MeddpiccBars({ scores }) {
  return (
    <div>
      {ELEMENTS.map((el) => {
        const v = scores[el];
        const pct = v == null ? 0 : (v / 10) * 100;
        return (
          <div className="bar-row" key={el}>
            <div className="bl">{LABELS[el]}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--series-1)' }} />
            </div>
            <div className="bv">{v == null ? '–' : v}</div>
          </div>
        );
      })}
    </div>
  );
}
