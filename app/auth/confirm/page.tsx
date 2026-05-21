"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-browser";

export default function AuthConfirm() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleAuth = async () => {
      // Prende il token dal fragment (#) dell'URL
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const error = params.get("error");

      if (error) {
        router.push("/register?error=" + error);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          router.push("/register?error=session");
          return;
        }

        router.push("/oggi");
        return;
      }

      // Fallback — prova con il codice nell'URL
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      
      if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!codeError) {
          router.push("/oggi");
          return;
        }
      }

      router.push("/register");
    };

    handleAuth();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 16, color: "#6b7490" }}>Accesso in corso...</div>
      </div>
    </div>
  );
}
