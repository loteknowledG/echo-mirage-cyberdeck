import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Mrs_Saint_Delafield, Satisfy } from 'next/font/google';

import './globals.css';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { ChunkReload } from '@/components/providers/chunk-reload';

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
  title: {
    default: "Echo Mirage Cyberdeck",
    template: "%s · Echo Mirage Cyberdeck",
  },
  description: "A floating, voice-locked cyberdeck for operators, agents, and live AI control.",
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
        <link rel="stylesheet" href="/vendor/pi-web-ui.css" />
      </head>
      <body
        className={`${GeistSans.className} ${SignatureScript.variable} ${SatisfyScript.variable} h-screen overflow-y-hidden overflow-x-auto`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          <div className="app-min-width-wrapper min-h-screen bg-background">
            <ChunkReload />
            {children}
            <script suppressHydrationWarning={true} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
