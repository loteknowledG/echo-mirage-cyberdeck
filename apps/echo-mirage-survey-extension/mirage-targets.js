/** Tab URL patterns where Echo Mirage cyberdeck runs. */
export const MIRAGE_TAB_URL_PATTERNS = [
  /^http:\/\/127\.0\.0\.1:\d+\//,
  /^http:\/\/localhost:\d+\//,
  /^https:\/\/echo-mirage-cyberdeck\.vercel\.app\//,
];

export function isMirageTabUrl(url) {
  if (!url) return false;
  return MIRAGE_TAB_URL_PATTERNS.some((pattern) => pattern.test(url));
}
