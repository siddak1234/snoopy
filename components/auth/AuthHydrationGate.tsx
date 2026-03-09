"use client";

import { useEffect, useState } from "react";
import { useAppSession } from "@/hooks/use-app-session";

export function AuthHydrationGate({
  destination,
  message = "Checking authentication…",
}: {
  destination: string;
  message?: string;
}) {
  const { data: session, status } = useAppSession({ retryIfEmpty: true });
  const [didTimeout, setDidTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDidTimeout(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      window.location.replace(destination);
    }
  }, [status, session?.user, destination]);

  // If we still didn't hydrate after a short window, fall back to login.
  useEffect(() => {
    if (!didTimeout) return;
    if (status === "unauthenticated") {
      window.location.replace(`/login?callbackUrl=${encodeURIComponent(destination)}`);
    }
  }, [didTimeout, status, destination]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="bubble p-6 sm:p-8">{message}</div>
    </div>
  );
}

