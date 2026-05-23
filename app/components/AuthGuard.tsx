"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const unlocked = localStorage.getItem("site_unlocked");
    if (unlocked !== "1") {
      window.location.href = `/login?from=${encodeURIComponent(pathname)}`;
    } else {
      setChecked(true);
    }
  }, [pathname]);

  if (!checked) return null;
  return <>{children}</>;
}
