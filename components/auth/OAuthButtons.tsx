import { safePlatformReturnTo } from "@/lib/platform-api";

type Provider = "google" | "microsoft" | "apple";

function oauthHref(provider: Provider, callbackUrl: string) {
  const next = safePlatformReturnTo(callbackUrl);
  return `/api/platform/v1/auth/oauth/${provider}/start?return_to=${encodeURIComponent(next)}`;
}

const buttonClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--ring)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none";

/**
 * Provider-only login entry points. The browser follows the Autom8x API route;
 * only the backend communicates with Supabase Auth.
 */
export function OAuthButtons({
  callbackUrl = "/account",
  mode = "login",
}: {
  callbackUrl?: string;
  mode?: "login" | "signup";
}) {
  const verb = mode === "signup" ? "Sign up" : "Continue";
  return (
    <div className="flex flex-col gap-2">
      <a href={oauthHref("google", callbackUrl)} className={buttonClass}>
        {verb} with Google
      </a>
      <a href={oauthHref("microsoft", callbackUrl)} className={buttonClass}>
        {verb} with Microsoft
      </a>
      <a href={oauthHref("apple", callbackUrl)} className={buttonClass}>
        {verb} with Apple
      </a>
    </div>
  );
}
