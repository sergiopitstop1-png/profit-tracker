import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/oggi", "/oggi-tennis", "/archivio", "/piano", "/profit-tracker"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some(r => path.startsWith(r));

  if (!isProtected) return NextResponse.next();

  const unlocked = req.cookies.get("site_unlocked")?.value;
  if (unlocked === "1") return NextResponse.next();

  const redirectUrl = new URL("/login", req.url);
  redirectUrl.searchParams.set("from", path);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/oggi/:path*", "/oggi-tennis/:path*", "/archivio/:path*", "/piano/:path*", "/profit-tracker/:path*"],
};
