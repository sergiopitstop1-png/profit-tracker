import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/oggi", "/oggi-tennis", "/archivio", "/piano", "/profit-tracker"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Non proteggere la pagina login e l'api login
  if (path.startsWith("/login") || path.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_ROUTES.some(r => path.startsWith(r));
  if (!isProtected) return NextResponse.next();

  // Prova a leggere il cookie in tutti i modi possibili
  const cookieHeader = req.headers.get("cookie") || "";
  const hasUnlocked = cookieHeader.includes("site_unlocked=1") ||
    req.cookies.get("site_unlocked")?.value === "1";

  if (hasUnlocked) return NextResponse.next();

  const redirectUrl = new URL("/login", req.url);
  redirectUrl.searchParams.set("from", path);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/oggi/:path*",
    "/oggi-tennis/:path*",
    "/archivio/:path*",
    "/piano/:path*",
    "/profit-tracker/:path*",
  ],
};
