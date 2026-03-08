import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthCallbackClient from "./AuthCallbackClient";

const DEFAULT_NEXT = "/account";

function getSafeNext(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_NEXT;
  if (!trimmed.startsWith("/")) return DEFAULT_NEXT;
  return trimmed;
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * OAuth callback: when the provider (e.g. Microsoft) redirects with ?code=... we exchange
 * on the server and redirect so cookies are set. When the code is only in the fragment
 * (#code=...), the server never sees it—we render a client component that exchanges
 * in the browser and redirects.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;
  const next = getSafeNext(
    typeof params.next === "string" ? params.next : null
  );
  const errorParam = typeof params.error === "string" ? params.error : null;
  const errorDescription =
    typeof params.error_description === "string"
      ? params.error_description
      : null;

  if (errorParam) {
    const q = new URLSearchParams({ error: "auth_callback" });
    if (errorDescription) q.set("error_description", errorDescription);
    redirect(`/login?${q.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    const q = new URLSearchParams({ error: "auth_callback" });
    q.set("error_description", error.message);
    redirect(`/login?${q.toString()}`);
  }

  return <AuthCallbackClient />;
}
