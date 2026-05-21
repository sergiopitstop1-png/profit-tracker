import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/oggi", "/oggi-tennis", "/archivio", "/piano"];
const VIP_ROUTES = ["/profit-tracker"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return req.cookies.get(name)?.value; },
        set(name, value, options) { res.cookies.set({ name, value, ...options }); },
        remove(name, options) { res.cookies.set({ name, value: "", ...options }); },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  // Pagine PronoX — richiede login
  const needsAuth = PROTECTED_ROUTES.some(r => path.startsWith(r));
  if (needsAuth && !session) {
    const redirectUrl = new URL("/register", req.url);
    redirectUrl.searchParams.set("from", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Pagine VIP — richiede ruolo vip o admin
  const needsVip = VIP_ROUTES.some(r => path.startsWith(r));
  if (needsVip && session) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const role = profile?.role || "user";
    if (role !== "vip" && role !== "admin") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/oggi/:path*", "/oggi-tennis/:path*", "/archivio/:path*", "/piano/:path*", "/profit-tracker/:path*"],
};
