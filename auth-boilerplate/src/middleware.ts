import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const CORS_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:5173",
].filter(Boolean) as string[];

function getCorsHeaders(request: NextRequest): Headers {
  const origin = request.headers.get("origin");
  const allowOrigin =
    origin && CORS_ALLOWED_ORIGINS.includes(origin)
      ? origin
      : CORS_ALLOWED_ORIGINS[0];
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  );
  return headers;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── CORS for Better Auth API ──────────────────────────
  if (pathname.startsWith("/api/auth")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }
    const response = NextResponse.next();
    getCorsHeaders(request).forEach((value, key) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // ── Protected routes (require authentication) ─────────
  const protectedRoutes = [
    "/dashboard",
    // Add your protected routes here
  ];

  // ── Auth routes (redirect if already authenticated) ───
  const authRoutes = ["/login", "/signup", "/forgot-password"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  const session = getSessionCookie(request);

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
