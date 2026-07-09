import Link from 'next/link';
import { getOverview } from '../lib/data';
import { TrendChart, FlagPills, HEALTH_COLOR } from '../components/ui';
import { AutoRefresh } from '../components/AutoRefresh';

export const dynamic = 'force-dynamic';

const ORDER = { critical: 0, warning: 1, good: 2 };

export default async function Page() {
  const deals = await getOverview();
  const crit = deals.filter((d) => d.health === 'critical').length;
  const watch = deals.filter((d) => d.health === 'warning').length;
  const healthy = deals.filter((d) => d.health === 'good').length;
  const sorted = [...deals].sort((a, b) => ORDER[a.health] - ORDER[b.health] || a.name.localeCompare(b.name));
  const featured =
    deals.filter((d) => d.callCount > 1 && d.health === 'critical').sort((a, b) => b.callCount - a.callCount)[0] ||
    deals.filter((d) => d.callCount > 1).sort((a, b) => b.callCount - a.callCount)[0] ||
    null;
  const champFlag = featured?.flags.find((f) => f.flag_type === 'CHAMPION_DECLINE');

  return (
    <main className="wrap">
      <AutoRefresh seconds={30} />
      <h2 className="sr-only">
        RevOps Command Center: {deals.length} deals — {crit} critical, {watch} watch, {healthy} healthy.
      </h2>

      <div className="head">
        <div>
          <div className="title">📊 RevOps Command Center</div>
          <div className="sub">Autonomous MEDDPICC deal-health monitoring · {deals.length} deals</div>
        </div>
        <div className="crumb">ShieldPoint pipeline</div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="n">{deals.length}</div>
          <div className="l">Deals monitored</div>
        </div>
        <div className="tile">
          <div className="n" style={{ color: 'var(--critical)' }}>{crit}</div>
          <div className="l"><span className="dot" style={{ background: 'var(--critical)' }} />Critical</div>
        </div>
        <div className="tile">
          <div className="n" style={{ color: 'var(--warning)' }}>{watch}</div>
          <div className="l"><span className="dot" style={{ background: 'var(--warning)' }} />Watch</div>
        </div>
        <div className="tile">
          <div className="n" style={{ color: 'var(--good)' }}>{healthy}</div>
          <div className="l"><span className="dot" style={{ background: 'var(--good)' }} />Healthy</div>
        </div>
      </div>

      <div className="body">
        <div className="panel">
          <h3>Pipeline</h3>
          {sorted.map((d) => (
            <Link className="deal" href={`/deals/${d.id}`} key={d.id}>
              <span className="dot" style={{ background: HEALTH_COLOR[d.health] }} />
              <div className="mid">
                <div className="nm">{d.name}</div>
                <div className="stg">{d.stage || '—'}</div>
              </div>
              <div className="pills"><FlagPills flags={d.flags} /></div>
            </Link>
          ))}
        </div>

        <div className="panel">
          <h3>{featured ? `Champion engagement · ${featured.name}` : 'Trend'}</h3>
          {featured ? (
            <>
              <TrendChart series={featured.championSeries} color="var(--critical)" />
              <div className="cap">
                {champFlag ? (
                  <>
                    🔴 <b>CHAMPION_DECLINE</b> — flagged automatically.{' '}
                  </>
                ) : null}
                No single call looks alarming; <b>the trajectory does</b>. This is the trend a human reviewer misses.
              </div>
            </>
          ) : (
            <div className="cap">A multi-call deal will show its trend here.</div>
          )}
        </div>
      </div>

      <div className="foot">
        <span className="live" /> Live from Supabase · scored by Claude · updates on every new call
      </div>
    </main>
  );
}
