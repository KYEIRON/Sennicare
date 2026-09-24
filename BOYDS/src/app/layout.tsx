import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: "BOYD'S Logistics LLC",
    template: "%s | BOYD'S Logistics LLC",
  },
  description:
    "BOYD'S Logistics LLC — business logistics, distribution and same-day delivery in North Carolina.",
  openGraph: {
    siteName: "BOYD'S Logistics LLC",
    locale: 'en_US',
    type: 'website',
  },
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
