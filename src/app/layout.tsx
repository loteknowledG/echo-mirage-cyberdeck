import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Mrs_Saint_Delafield, Satisfy } from 'next/font/google';

import { getAppReleaseVersion } from "@/lib/app-release-version.server";

import './globals.css';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AppUpdatePrompt } from '@/components/providers/app-update-prompt';
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const releaseVersion = getAppReleaseVersion();

  return (
    <html lang="en" suppressHydrationWarning data-echo-mirage-release={releaseVersion}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="echo-mirage-release" content={releaseVersion} />
      </head>
      <body
        className={`${GeistSans.className} ${SignatureScript.variable} ${SatisfyScript.variable} h-screen overflow-y-hidden overflow-x-auto`}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          <QueryProvider>
            <div className="app-min-width-wrapper min-h-screen bg-background">
              <ChunkReload />
              <AppUpdatePrompt />
              {children}
              <script suppressHydrationWarning={true} />
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
