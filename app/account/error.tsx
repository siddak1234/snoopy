"use client";

import { PlatformUnavailable } from "@/components/dashboard/PlatformUnavailable";

/**
 * A page in the account area that could not load its data — a refused or failed
 * platform read, now that `getAppSession()` no longer turns those into "signed
 * out" (backend §12.1 #160). Inside the account layout, so the navigation stays.
 * The layout's own failure is handled in the layout: this boundary does not wrap
 * the layout of its own segment.
 */
export default function AccountError({ retry }: { retry: () => void }) {
  return <PlatformUnavailable retry={retry} />;
}
