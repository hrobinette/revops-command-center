import { ELEMENTS, LABELS } from '../lib/data';

export const HEALTH_COLOR = { critical: 'var(--crit)', warning: 'var(--warn)', good: 'var(--good)' };

const SHORT = {
  NO_EB_LATE_STAGE: 'No EB',
  NO_PAPER_PROCESS_LATE: 'Paper',
  CHAMPION_DECLINE: 'Champion ↓',
  UNQUALIFIED: 'Unqualified',
  COMPETITIVE_EXPOSURE: 'Competitive',
};

export function FlagPills({ flags }) {
  if (!flags.length) return <span className="pill g">Clean</span>;
  return (
    <>
      {flags.map((f, i) => (
        <span key={i} className={`pill ${f.severity === 'red' ? 'r' : 'y'}`}>
          {SHORT[f.flag_type] || f.flag_type}
        </span>
      ))}
    </>
  );
}

/** Single-series line chart of a score (0–10) across calls. */
export function TrendChart({ series, color = 'var(--crit)', height = 200 }) {
  const W = 380;
  const H = height;
  const padL = 40;
  const padR = 26;
  const padT = 22;
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
      <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="var(--line)" strokeWidth="1" />
      <line x1={padL} y1={padT + plotH / 2} x2={W - padR} y2={padT + plotH / 2} stroke="var(--line)" strokeWidth="1" />
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--baseline)" strokeWidth="1" />
      <text x={padL - 8} y={padT + 4} textAnchor="end" fontSize="10" fill="var(--muted)">10</text>
      <text x={padL - 8} y={padT + plotH / 2 + 4} textAnchor="end" fontSize="10" fill="var(--muted)">5</text>
      <text x={padL - 8} y={padT + plotH + 4} textAnchor="end" fontSize="10" fill="var(--muted)">0</text>
      {area && <path d={area} fill={color} fillOpacity="0.07" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) =>
        c.cy == null ? null : (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r="4.5" fill="var(--card)" stroke={color} strokeWidth="2.5">
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

/** Tiny sparkline of one element's score across calls, colored by direction. */
export function MiniTrend({ label, series }) {
  const pts = series.filter((p) => p.score != null);
  const first = pts[0]?.score;
  const last = pts[pts.length - 1]?.score;
  const dir = last == null || first == null ? 'flat' : last < first ? 'down' : last > first ? 'up' : 'flat';
  const color = dir === 'down' ? 'var(--crit)' : dir === 'up' ? 'var(--good)' : 'var(--muted)';
  const W = 130;
  const H = 46;
  const padX = 6;
  const padT = 8;
  const padB = 8;
  const n = series.length;
  const x = (i) => padX + (n <= 1 ? (W - 2 * padX) / 2 : (i / (n - 1)) * (W - 2 * padX));
  const y = (s) => padT + (1 - s / 10) * (H - padT - padB);
  const line = series
    .map((p, i) => (p.score == null ? null : `${x(i)},${y(p.score)}`))
    .filter(Boolean)
    .join(' ');
  const arrow = dir === 'down' ? ' ↓' : dir === 'up' ? ' ↑' : '';
  return (
    <div className="mini">
      <div className="mini-head">
        <span className="mini-l">{label}</span>
        <span className="mini-v" style={{ color }}>
          {last == null ? '–' : last}
          {arrow}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p, i) => (p.score == null ? null : <circle key={i} cx={x(i)} cy={y(p.score)} r="2.5" fill={color} />))}
      </svg>
    </div>
  );
}

/** Grid of per-element sparklines across a deal's calls. */
export function ElementTrends({ calls }) {
  const series = (el) => calls.map((c) => ({ call: c.call, score: c.scores[el] ?? null }));
  return (
    <div className="minis">
      {ELEMENTS.map((el) => (
        <MiniTrend key={el} label={LABELS[el]} series={series(el)} />
      ))}
    </div>
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
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="bv">{v == null ? '–' : v}</div>
          </div>
        );
      })}
    </div>
  );
}
