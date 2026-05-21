"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-browser";

export default function AuthConfirm() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleAuth = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const error = params.get("error");

      if (error) { router.push("/login?error=" + error); return; }

      // Token JWT completo
      if (accessToken && accessToken.length > 20 && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) { router.push("/login?error=session"); return; }
        window.location.href = "/oggi";
        return;
      }

      // OTP numerico
      if (accessToken && accessToken.length <= 20) {
        const email = localStorage.getItem("otp_email") || "";
        if (!email) { router.push("/login?error=no_email"); return; }
        const { error: otpError } = await supabase.auth.verifyOtp({
          email,
          token: accessToken,
          type: "magiclink",
        });
        if (otpError) { router.push("/login?error=otp"); return; }
        localStorage.removeItem("otp_email");
        window.location.href = "/oggi";
        return;
      }

      // PKCE code
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!codeError) { window.location.href = "/oggi"; return; }
      }

      router.push("/login?error=unknown");
    };

    handleAuth();
  }, []);

  return (
    <main style={{ background: "#0d0f14", color: "#e8ecf5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <p style={{ color: "#6b7490", fontSize: 15 }}>Accesso in corso...</p>
      </div>
    </main>
  );
}
