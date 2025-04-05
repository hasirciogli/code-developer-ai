import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Public paths that don't require authentication
const publicPaths = ["/", "/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname === path || pathname.startsWith("/api/auth"))) {
    // If user is already authenticated and tries to access login page,
    // redirect them to the projects page
    if (token && pathname === "/login") {
      return NextResponse.redirect(new URL("/projects", request.url));
    }
    return NextResponse.next();
  }

  // Check auth status for protected routes
  if (!token) {
    // Redirect to login page with callbackUrl
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth/* (authentication routes)
     * 2. /_next/static (static files)
     * 3. /_next/image (image optimization files)
     * 4. /favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
