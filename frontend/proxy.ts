import { NextRequest, NextResponse } from "next/server";

// Auth state lives in localStorage (Zustand persist) which is client-only.
// Route protection is handled client-side via AuthGuard in the dashboard layout.
// This proxy only handles the root redirect.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
