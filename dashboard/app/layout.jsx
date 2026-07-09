import './globals.css';

export const metadata = {
  title: 'RevOps Command Center',
  description: 'Autonomous MEDDPICC deal-health monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
