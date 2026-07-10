export type OperatorBrowserLiveSnapshot = {
  url: string;
  title: string;
  pageText: string;
  status: number;
  engine?: "playwright" | "firecrawl" | "tinyfish";
};

export type OperatorBrowserLiveResult =
  | { ok: true; snapshot: OperatorBrowserLiveSnapshot }
  | { ok: false; error: string };
