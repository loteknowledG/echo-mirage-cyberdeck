import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Mrs_Saint_Delafield, Satisfy } from 'next/font/google';

import './globals.css';

import { ThemeProvider } from '@/components/providers/theme-provider';
// Register service worker for PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const SignatureScript = Mrs_Saint_Delafield({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-mrs-saint-delafield',
  display: 'swap',
});

const SatisfyScript = Satisfy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-satisfy',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Echo Mirage Cyberdeck",
  description: "AI-first hacker terminal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${GeistSans.className} ${SignatureScript.variable} ${SatisfyScript.variable} h-screen overflow-y-hidden overflow-x-auto`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          <div className="app-min-width-wrapper">
            {children}
            <script suppressHydrationWarning={true} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
