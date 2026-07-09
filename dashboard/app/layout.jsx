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
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
