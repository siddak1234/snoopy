"use client";

import { useEffect, useState } from "react";
import { toAppSession, type AppSession } from "@/lib/session-contract";
import { platformApiPath } from "@/lib/platform-api";

const RETRY_DELAY_MS = 800;
const MAX_RETRIES = 3;

export function useAppSession(options?: {
  /** When true, retries session fetch if empty (e.g. after OAuth redirect). */
  retryIfEmpty?: boolean;
}): {
  data: AppSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
} {
  const [data, setData] = useState<AppSession | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const retryIfEmpty = options?.retryIfEmpty ?? false;

  useEffect(() => {
    let cancelled = false;

    async function fetchSession(attempt: number): Promise<void> {
      try {
        const res = await fetch(platformApiPath("/v1/session"), {
          credentials: "same-origin",
        });
        const session = toAppSession(await res.json().catch(() => null));
        if (cancelled) return;

        if (res.ok && session) {
          setData(session);
          setStatus("authenticated");
          return;
        }

        const shouldRetry = retryIfEmpty && attempt < MAX_RETRIES;
        if (shouldRetry) {
          setTimeout(() => {
            if (!cancelled) fetchSession(attempt + 1);
          }, RETRY_DELAY_MS);
        } else {
          setData(null);
          setStatus("unauthenticated");
        }
      } catch {
        if (cancelled) return;
        const shouldRetry = retryIfEmpty && attempt < MAX_RETRIES;
        if (shouldRetry) {
          setTimeout(() => {
            if (!cancelled) fetchSession(attempt + 1);
          }, RETRY_DELAY_MS);
        } else {
          setData(null);
          setStatus("unauthenticated");
        }
      }
    }

    fetchSession(0);
    return () => {
      cancelled = true;
    };
  }, [retryIfEmpty]);

  return { data: data ?? null, status };
}
