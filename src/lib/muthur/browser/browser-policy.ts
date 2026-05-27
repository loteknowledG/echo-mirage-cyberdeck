export const DEFAULT_BROWSER_BASE_URL = "http://127.0.0.1:3050";

export const APPROVED_VERIFICATION_ROUTES = ["/", "/cyberdeck", "/preview"] as const;

const LOCALHOST_URL_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i;

export function resolveBrowserUrl(routeOrUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(routeOrUrl)) return routeOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const route = routeOrUrl.startsWith("/") ? routeOrUrl : `/${routeOrUrl}`;
  return `${base}${route}`;
}

export function validateBrowserUrl(
  routeOrUrl: string,
  baseUrl: string = DEFAULT_BROWSER_BASE_URL,
): { ok: true; url: string } | { ok: false; reason: string; url: string } {
  const url = resolveBrowserUrl(routeOrUrl, baseUrl);
  if (!LOCALHOST_URL_PATTERN.test(url)) {
    return {
      ok: false,
      reason: "Browser navigation is limited to localhost (127.0.0.1 / localhost) in L-12.",
      url,
    };
  }
  return { ok: true, url };
}

export function isApprovedVerificationRoute(route: string): boolean {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return (APPROVED_VERIFICATION_ROUTES as readonly string[]).includes(normalized);
}

export function normalizeVerificationRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed || trimmed === "/") return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withSlash.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

export function urlPathname(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    return pathname || "/";
  } catch {
    return "/";
  }
}

/** True when `url` resolves to the requested app route (not substring match). */
export function urlMatchesRoute(url: string, route: string): boolean {
  const normalizedRoute = normalizeVerificationRoute(route);
  const pathname = urlPathname(url);
  if (normalizedRoute === "/") return pathname === "/";
  return pathname === normalizedRoute || pathname.startsWith(`${normalizedRoute}/`);
}
