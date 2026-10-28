import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transport Operations Dashboard',
  description: 'Administrative, association manager, and terminal clerk operations.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
