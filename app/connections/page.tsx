import { redirect } from "next/navigation";

export default async function ConnectionsCallbackPage({
  searchParams,
}: PageProps<"/connections">) {
  const { status } = await searchParams;

  // The Edge already emits only these fixed callback tokens. Do not reflect a
  // provider's query string or error text into the dashboard URL.
  if (status === "connected" || status === "error") {
    redirect(`/account/connections?status=${status}`);
  }
  redirect("/account/connections");
}
