import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("site_unlocked", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Nessuna scadenza = sessione browser (scompare alla chiusura del browser)
    // Se vuoi che duri anche dopo chiusura, decommenta la riga sotto:
    // maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
