import './globals.css';
import { AppBar } from '../components/AppBar';

export const metadata = {
  title: 'RevOps Command Center',
  description: 'Autonomous MEDDPICC deal-health monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppBar />
        <div className="samplebar">
          <b>Sample data</b> — every deal, score, and dollar figure here is illustrative demo data for a capstone
          project, not a real pipeline.
        </div>
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
