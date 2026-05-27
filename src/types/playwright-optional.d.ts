/** Optional runtime dependency — not installed in production/Vercel builds. */
declare module "playwright" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const chromium: any;
}
