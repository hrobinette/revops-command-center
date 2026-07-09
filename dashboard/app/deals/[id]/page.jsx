import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeal } from '../../../lib/data';
import { MeddpiccBars, TrendChart, ElementTrends, HEALTH_COLOR } from '../../../components/ui';
import { AutoRefresh } from '../../../components/AutoRefresh';
import { FLAG_ELEMENT, RECOMMENDATION } from '../../../lib/recommendations';

export const dynamic = 'force-dynamic';

const HEALTH_LABEL = { critical: 'Critical', warning: 'Watch', good: 'Healthy' };
const HEALTH_BADGE = { critical: 'crit', warning: 'warn', good: 'good' };

export default async function DealPage({ params }) {
  const data = await getDeal(params.id);
  if (!data) notFound();
  const { deal, calls, flags, health, latestEvidence } = data;
  const latest = calls[calls.length - 1];
  const championSeries = calls.map((c) => ({ call: c.call, score: c.scores.champion ?? null }));
  const multi = calls.length > 1;

  return (
    <>
      <AutoRefresh seconds={30} />
      <Link className="back" href="/">← All deals</Link>

      <div className="pagehead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="h">
            <span className="stat" style={{ background: HEALTH_COLOR[health], marginRight: 9, width: 10, height: 10 }} />
            {deal.name}
          </div>
          <div className="s" style={{ textTransform: 'capitalize' }}>
            {deal.stage || '—'} · {calls.length} call{calls.length === 1 ? '' : 's'}
            {deal.hubspot_deal_id ? ` · HubSpot #${deal.hubspot_deal_id}` : ''}
          </div>
        </div>
        <span className={`badge ${HEALTH_BADGE[health]}`}>{HEALTH_LABEL[health]}</span>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-h"><h3>MEDDPICC · latest call</h3></div>
          <div className="card-b"><MeddpiccBars scores={latest?.scores || {}} /></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Champion engagement</h3></div>
          <div className="card-b">
            {multi ? (
              <>
                <TrendChart series={championSeries} color={health === 'critical' ? 'var(--crit)' : 'var(--brand)'} />
                <div className="cap">Champion score per call — the trajectory the system watches automatically.</div>
              </>
            ) : (
              <div className="cap">Single call so far — the trend builds as more calls come in.</div>
            )}
          </div>
        </div>
      </div>

      {multi && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><h3>Every dimension, across calls</h3></div>
          <div className="card-b">
            <ElementTrends calls={calls} />
            <div className="cap">↓ red = declining · ↑ green = improving. The system tracks all eight, not just champion.</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>Risk flags</h3></div>
        <div className="card-b">
          {flags.length ? (
            flags.map((f, i) => {
              const el = FLAG_ELEMENT[f.flag_type];
              const evidence = el ? latestEvidence[el] : null;
              const rec = RECOMMENDATION[f.flag_type];
              return (
                <div className="flagcard" key={i}>
                  <div className="ft">
                    {f.severity === 'red' ? '🔴' : '🟡'} {f.flag_type}
                  </div>
                  <div className="fd">{f.detail}</div>
                  {evidence ? <div className="evidence">“{evidence}”</div> : null}
                  {rec ? (
                    <div className="rec">
                      <b>Recommended next step:</b> {rec}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="clean">✓ No risk flags — healthy deal.</div>
          )}
        </div>
      </div>
    </>
  );
}
