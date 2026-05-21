import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pagine che richiedono login
const PROTECTED_ROUTES = ["/oggi", "/oggi-tennis", "/archivio", "/piano"];

// Pagine che richiedono ruolo VIP o admin
const VIP_ROUTES = ["/profit-tracker"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Controlla pagine PronoX — richiede solo login
  const needsAuth = PROTECTED_ROUTES.some(r => path.startsWith(r));
  if (needsAuth && !session) {
    const redirectUrl = new URL("/register", req.url);
    redirectUrl.searchParams.set("from", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Controlla pagine VIP — richiede ruolo vip o admin
  const needsVip = VIP_ROUTES.some(r => path.startsWith(r));
  if (needsVip && session) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const role = profile?.role || "user";
    if (role !== "vip" && role !== "admin") {
      // Non è VIP — redirect al login tradizionale
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/oggi/:path*", "/oggi-tennis/:path*", "/archivio/:path*", "/piano/:path*", "/profit-tracker/:path*"],
};
