import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));

    if (hasSupabaseAuthCookies) {
      return <AuthHydrationGate destination="/dashboard" />;
    }

    redirect("/login?callbackUrl=/dashboard");
  }

  return <>{children}</>;
}
