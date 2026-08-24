import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: "BOYD'S Logistics LLC",
    template: "%s | BOYD'S Logistics LLC",
  },
  description:
    "BOYD'S Logistics LLC — business logistics, distribution and same-day delivery in North Carolina.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a1628',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
