"use client";

import { useEffect, useState } from "react";
import {
  PlatformUnavailable,
  SessionEnded,
} from "@/components/dashboard/PlatformUnavailable";
import { platformApiJson, sessionEnded } from "@/lib/platform-api";

/**
 * A page in the account area that could not load its data — a refused or failed
 * platform read, now that `getAppSession()` no longer turns those into "signed
 * out" (backend §12.1 #160). Inside the account layout, so the navigation stays.
 * The layout's own failure is handled in the layout: this boundary does not wrap
 * the layout of its own segment.
 *
 * The error a server render throws reaches the browser as a message-less digest,
 * so this boundary cannot tell a 401 from a 503. It asks the platform instead:
 * a session that ended while the page loaded is said, with the way back in, and
 * never read as "you have not been signed out" (register F60).
 */
export default function AccountError({ retry }: { retry: () => void }) {
  const [session, setSession] = useState<
    "checking" | "kept" | "ended" | "unknown"
  >("checking");
  useEffect(() => {
    let current = true;
    platformApiJson("/v1/session").then(
      () => {
        if (current) setSession("kept");
      },
      (error: unknown) => {
        if (current) setSession(sessionEnded(error) ? "ended" : "unknown");
      },
    );
    return () => {
      current = false;
    };
  }, []);
  if (session === "ended") return <SessionEnded />;
  return <PlatformUnavailable retry={retry} sessionKept={session === "kept"} />;
}
