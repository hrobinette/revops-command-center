import Link from 'next/link';

export function AppBar() {
  return (
    <header className="bar">
      <Link className="brand" href="/">
        <span>
          <span className="bname">RevOps Command Center</span>
          <span className="btag">MEDDPICC deal-health monitoring</span>
        </span>
      </Link>
      <span className="live"><span className="d" /> Live</span>
    </header>
  );
}
