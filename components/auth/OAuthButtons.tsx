type Provider = "google" | "azure";

function oauthHref(provider: Provider, callbackUrl: string) {
  const next = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`;
  return `/api/auth/oauth?provider=${provider}&next=${encodeURIComponent(next)}`;
}

const buttonClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--ring)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none";

/** The "or" rule between the credentials form and the OAuth options. */
export function OAuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-[var(--ring)]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[var(--surface)] px-3 text-sm text-[var(--muted)]">
          or
        </span>
      </div>
    </div>
  );
}

/**
 * Google + Microsoft OAuth entry points, shared by login and signup
 * (previously duplicated inline on both pages).
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
      <a href={oauthHref("azure", callbackUrl)} className={buttonClass}>
        {verb} with Microsoft
      </a>
    </div>
  );
}
