import Link from 'next/link';

export function AppBar() {
  return (
    <header className="bar">
      <Link className="brand" href="/">
        <span className="logo">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" />
            <path d="M8.5 12.5l2 2 4-4.5" />
          </svg>
        </span>
        <span>
          <span className="bname">RevOps Command Center</span>
          <span className="btag">ShieldPoint · MEDDPICC deal-health</span>
        </span>
      </Link>
      <span className="live"><span className="d" /> Live</span>
    </header>
  );
}
