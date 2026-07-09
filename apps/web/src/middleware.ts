import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedPage =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/screener") ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/alerts");

  const refreshToken = request.cookies.get("refresh_token")?.value;

  // 1. If trying to access protected route without a session, redirect to login
  if (isProtectedPage && !refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If logged in and accessing login/register, redirect to screener page
  if (isAuthPage && refreshToken) {
    return NextResponse.redirect(new URL("/screener", request.url));
  }

  // 3. For root page /, redirect to screener if logged in, otherwise let it fall through to landing page
  if (pathname === "/") {
    if (refreshToken) {
      return NextResponse.redirect(new URL("/screener", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (Next.js API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - next.svg, vercel.svg (images)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|next.svg|vercel.svg).*)",
  ],
};
