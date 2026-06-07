import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '1oone Rep Dashboard',
  description: 'Field rep visit tracking and call cycle adherence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
