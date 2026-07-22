import Link from 'next/link';
import { getOverview } from '../lib/data';
import { TrendChart, FlagPills, HEALTH_COLOR } from '../components/ui';
import { AutoRefresh } from '../components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ORDER = { critical: 0, warning: 1, good: 2 };
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
const MOM_COLOR = { improving: 'var(--good)', declining: 'var(--crit)', flat: 'var(--muted)', new: 'var(--muted)' };

export default async function Page() {
  const deals = await getOverview();
  const crit = deals.filter((d) => d.health === 'critical').length;
  const watch = deals.filter((d) => d.health === 'warning').length;
  const healthy = deals.filter((d) => d.health === 'good').length;
  const committed = deals.reduce((s, d) => s + (d.amount || 0), 0);
  const riskAdjusted = deals.reduce((s, d) => s + (d.riskAdjusted || 0), 0);
  const erosionPct = committed ? Math.round(((committed - riskAdjusted) / committed) * 100) : 0;
  const sorted = [...deals].sort((a, b) => ORDER[a.health] - ORDER[b.health] || a.name.localeCompare(b.name));
  // Feature the deal that actually tells the champion-decline story (the whole
  // point of this panel); fall back to the busiest at-risk deal, then any
  // multi-call deal.
  const featured =
    deals.filter((d) => d.flags.some((f) => f.flag_type === 'CHAMPION_DECLINE')).sort((a, b) => b.callCount - a.callCount)[0] ||
    deals.filter((d) => d.callCount > 1 && d.health === 'critical').sort((a, b) => b.callCount - a.callCount)[0] ||
    deals.filter((d) => d.callCount > 1).sort((a, b) => b.callCount - a.callCount)[0] ||
    null;
  const champFlag = featured?.flags.find((f) => f.flag_type === 'CHAMPION_DECLINE');

  return (
    <>
      <AutoRefresh seconds={30} />
      <h2 className="sr-only">
        RevOps Command Center: {deals.length} deals — {crit} critical, {watch} watch, {healthy} healthy.
      </h2>

      <div className="kpis">
        <div className="kpi">
          <div className="lab">Deals monitored</div>
          <div className="val">{deals.length}</div>
          <div className="hint">across the pipeline</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--crit)' }}>
          <div className="lab">Critical</div>
          <div className="val" style={{ color: 'var(--crit)' }}>{crit}</div>
          <div className="hint">need attention now</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--warn)' }}>
          <div className="lab">Watch</div>
          <div className="val" style={{ color: 'var(--warn)' }}>{watch}</div>
          <div className="hint">trending at risk</div>
        </div>
        <div className="kpi" style={{ '--accent': 'var(--good)' }}>
          <div className="lab">Healthy</div>
          <div className="val" style={{ color: 'var(--good)' }}>{healthy}</div>
          <div className="hint">on track</div>
        </div>
      </div>

      <div className="fcast">
        <div className="fcast-h">
          <h3>Risk-adjusted forecast</h3>
          <span className="badge warn">{erosionPct}% risk discount</span>
        </div>
        <div className="fcast-nums">
          <div className="fc-item">
            <div className="fc-lab">Committed pipeline</div>
            <div className="fc-val">{usd(committed)}</div>
          </div>
          <div className="fc-arrow">→</div>
          <div className="fc-item">
            <div className="fc-lab">Risk-adjusted</div>
            <div className="fc-val" style={{ color: 'var(--brand)' }}>{usd(riskAdjusted)}</div>
          </div>
        </div>
        <div className="fc-bar" aria-hidden="true">
          <div className="fc-bar-fill" style={{ width: `${committed ? (riskAdjusted / committed) * 100 : 0}%` }} />
        </div>
        <div className="cap">
          Committed pipeline weighted by each deal’s <b>MEDDPICC completeness</b> and <b>momentum</b> — what’s
          actually de-risked, not the raw sum.
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-h">
            <h3>Pipeline</h3>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{deals.length} deals</span>
          </div>
          {sorted.map((d) => (
            <Link className="row" href={`/deals/${d.id}`} key={d.id}>
              <span className="stat" style={{ background: HEALTH_COLOR[d.health] }} />
              <div className="mid">
                <div className="nm">{d.name}</div>
                <div className="sg">{d.stage || '—'}</div>
              </div>
              {d.amount != null && (
                <div className="ra" title={`${usd(d.amount)} committed · ${Math.round(d.completeness * 100)}% MEDDPICC · ${d.momentum.dir}`}>
                  <span className="ra-v">{usd(d.riskAdjusted)}</span>
                  <span className="ra-m" style={{ color: MOM_COLOR[d.momentum.dir] }}>{d.momentum.arrow}</span>
                </div>
              )}
              <div className="fl"><FlagPills flags={d.flags} /></div>
              <span className="chev">›</span>
            </Link>
          ))}
          <div className="row-hint">Click any deal for its full MEDDPICC scorecard, evidence, and next steps →</div>
        </div>

        {featured ? (
          <Link className="card card-link" href={`/deals/${featured.id}`}>
            <div className="card-h">
              <h3>Champion trend · {featured.name}</h3>
              {champFlag ? <span className="badge crit">Declining</span> : null}
            </div>
            <div className="card-b">
              <TrendChart series={featured.championSeries} color={champFlag ? 'var(--crit)' : 'var(--brand)'} />
              <div className="cap">
                {champFlag ? (
                  <>
                    <b>Champion declining</b> — flagged automatically. No single call looks alarming;{' '}
                    <b>the trajectory does</b>. The trend a human reviewer misses.
                  </>
                ) : (
                  <>Champion engagement across this deal’s calls — the trajectory the system tracks automatically.</>
                )}{' '}
                <span className="cap-link">Open {featured.name} →</span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="card">
            <div className="card-h">
              <h3>Champion trend</h3>
            </div>
            <div className="card-b">
              <div className="cap">A multi-call deal will show its champion trend here.</div>
            </div>
          </div>
        )}
      </div>

      <div className="foot">
        <span className="d" /> Live from Supabase · scored by Claude · auto-refreshes every 30s
      </div>
    </>
  );
}
