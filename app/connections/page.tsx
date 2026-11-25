import { redirect } from "next/navigation";
import { ehrSignInReturn } from "@/lib/smart-backend";

export default async function ConnectionsCallbackPage({
  searchParams,
}: PageProps<"/connections">) {
  const { status, reason } = await searchParams;

  // The Edge already emits only these fixed callback tokens. Do not reflect a
  // provider's query string or error text into the dashboard URL: only a
  // refused EHR sign-in's reason that has words here (backend ADR-0054,
  // `ehrSignInReturn`) travels on, and anything else is dropped.
  if (status === "connected") redirect("/account/connections?status=connected");
  if (status === "error") {
    const known = ehrSignInReturn(reason) === null ? null : String(reason);
    redirect(
      known
        ? `/account/connections?status=error&reason=${encodeURIComponent(known)}`
        : "/account/connections?status=error",
    );
  }
  redirect("/account/connections");
}
