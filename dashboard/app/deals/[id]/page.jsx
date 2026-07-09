import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeal } from '../../../lib/data';
import { MeddpiccBars, TrendChart, HEALTH_COLOR } from '../../../components/ui';

export const dynamic = 'force-dynamic';

const HEALTH_LABEL = { critical: 'Critical', warning: 'Watch', good: 'Healthy' };

export default async function DealPage({ params }) {
  const data = await getDeal(params.id);
  if (!data) notFound();
  const { deal, calls, flags, health } = data;
  const latest = calls[calls.length - 1];
  const championSeries = calls.map((c) => ({ call: c.call, score: c.scores.champion ?? null }));
  const multi = calls.length > 1;

  return (
    <main className="wrap">
      <Link className="back" href="/">← All deals</Link>

      <div className="head">
        <div>
          <div className="title">
            <span className="dot" style={{ background: HEALTH_COLOR[health], marginRight: 9 }} />
            {deal.name}
          </div>
          <div className="sub" style={{ textTransform: 'capitalize' }}>
            {deal.stage || '—'} · {calls.length} call{calls.length === 1 ? '' : 's'} · {HEALTH_LABEL[health]}
          </div>
        </div>
        {deal.hubspot_deal_id ? <div className="crumb">HubSpot #{deal.hubspot_deal_id}</div> : null}
      </div>

      <div className="detail-grid">
        <div className="panel">
          <h3>MEDDPICC · latest call</h3>
          <MeddpiccBars scores={latest?.scores || {}} />
        </div>
        <div className="panel">
          <h3>Champion engagement across calls</h3>
          {multi ? (
            <>
              <TrendChart series={championSeries} color={health === 'critical' ? 'var(--critical)' : 'var(--series-1)'} />
              <div className="cap">Champion score per call — the trajectory the system watches automatically.</div>
            </>
          ) : (
            <div className="cap">Single call so far — the trend builds as more calls come in.</div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Risk flags</h3>
        {flags.length ? (
          flags.map((f, i) => (
            <div className="flagcard" key={i}>
              <div className="ft">
                {f.severity === 'red' ? '🔴' : '🟡'} {f.flag_type}
              </div>
              <div className="fd">{f.detail}</div>
            </div>
          ))
        ) : (
          <div className="clean">✓ No risk flags — healthy deal.</div>
        )}
      </div>
    </main>
  );
}
