"use client";

import { useEffect, useState } from "react";
import { OutsideSignIn } from "@/components/account/OutsideSignIn";
import {
  PlatformUnavailable,
  SessionEnded,
} from "@/components/dashboard/PlatformUnavailable";
import {
  outsideOnError,
  type OutsideSignIn as Provider,
} from "@/lib/domain-only";
import { platformApiJson, sessionEnded } from "@/lib/platform-api";
import { PAGE_CARD, SPACING } from "@/lib/spacing";

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
 *
 * A domain-only organization refuses a sign-in outside its verified domains
 * only on a read billed to it (backend §12.1 #221, S1-11), so a page's own
 * read meets that refusal and lands here. With the session kept, this screen
 * makes ONE read that names the active workspace (`outsideOnError`): refused
 * `outside_org_domain`, it draws the screen that removes those sign-ins
 * (`OutsideSignIn`) in place of the platform's notice. No page that loaded
 * makes that read.
 */
export default function AccountError({ retry }: { retry: () => void }) {
  const [session, setSession] = useState<
    "checking" | "kept" | "ended" | "unknown"
  >("checking");
  const [outside, setOutside] = useState<Provider[] | null>(null);
  useEffect(() => {
    let current = true;
    platformApiJson("/v1/session").then(
      async (kept) => {
        const refused = await outsideOnError(kept, (path) =>
          platformApiJson(path),
        );
        if (!current) return;
        setOutside(refused);
        setSession("kept");
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
  if (outside) return <OutsideSignIn providers={outside} onRemoved={retry} />;
  // Nothing is claimed until the platform answers — not an alert, and not a
  // cause that may turn out to be the wrong one.
  if (session === "checking") {
    return (
      <section
        aria-busy="true"
        className={`bubble mx-auto ${SPACING.group.top} flex max-w-lg flex-col ${SPACING.inner.gap} ${PAGE_CARD}`}
      >
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </section>
    );
  }
  return <PlatformUnavailable retry={retry} sessionKept={session === "kept"} />;
}
