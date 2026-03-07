"use client";

import { useEffect, useState } from "react";
import type { AppSession } from "@/lib/auth-supabase";

export function useAppSession(): {
  data: AppSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
} {
  const [data, setData] = useState<AppSession | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((session) => {
        setData(session?.user ? session : null);
        setStatus(session?.user ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        setData(null);
        setStatus("unauthenticated");
      });
  }, []);

  return { data: data ?? null, status };
}
