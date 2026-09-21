import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route gating.
 *
 * This is the coarse gate: it keeps signed-out users off every page but the
 * sign-in screen. It deliberately does NOT decide role permissions — the JWT
 * cookie alone is not proof of a current role, since a demotion must take
 * effect immediately. Role checks happen in the pages and Server Actions,
 * where the database is readable.
 */

const PUBLIC_PREFIXES = ["/sign-in", "/api/auth"];

/** The landing page, matched exactly so it does not open up every route. */
const PUBLIC_EXACT = ["/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Auth.js sets a host-prefixed cookie over HTTPS.
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
