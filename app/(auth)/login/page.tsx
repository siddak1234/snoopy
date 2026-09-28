import { Suspense } from "react";
import type { LoginProvider } from "@/components/auth/OAuthButtons";
import { platformPublicJson } from "@/lib/platform-server";
import type { operations } from "@/lib/generated/platform-contracts/platform";
import { LoginForm } from "./LoginForm";

type LoginProvidersResponse =
  operations["listLoginProviders"]["responses"][200]["content"]["application/json"];

/**
 * The provider list, read once a minute on the server rather than once a view in
 * the browser — backend §12.1 #160, ADR-0029. It is the one read every signed-out
 * visitor makes, it is identical for everyone, and a signed-out visitor shares the
 * website's address bucket at the Edge. A failed read is not an error here: the
 * buttons fall back to asking from the browser, exactly as before.
 */
async function cachedLoginProviders(): Promise<LoginProvider[] | undefined> {
  try {
    const response = await platformPublicJson<LoginProvidersResponse>(
      "/v1/auth/providers",
      60,
    );
    return response.providers;
  } catch {
    return undefined;
  }
}

/**
 * Rendered per request, not prerendered: a prerender would make the read above at
 * BUILD time, tying the build to the platform and shipping a page without
 * providers whenever that read failed. The read itself stays cached for a minute,
 * because a fetch with a positive `revalidate` keeps its cache under
 * `revalidate = 0` (Next's "caching without cache components" guide).
 */
export const revalidate = 0;

export default async function LoginPage() {
  const providers = await cachedLoginProviders();
  return (
    <Suspense fallback={<div className="bubble p-6 sm:p-8">Loading…</div>}>
      <LoginForm providers={providers} />
    </Suspense>
  );
}
