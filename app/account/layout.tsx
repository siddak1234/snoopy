import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { DashboardSidebar, DashboardHeader } from "@/components/dashboard/DashboardNav";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user?.email || !session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));

    if (hasSupabaseAuthCookies) {
      // We likely just returned from OAuth and cookies exist, but getUser() can
      // transiently return null during hydration/refresh. Render a deterministic
      // client gate instead of redirecting back to /login.
      return <AuthHydrationGate destination="/account" />;
    }

    redirect("/login?callbackUrl=/account");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">
          <header className="mb-4 lg:mb-0">
            <DashboardHeader />
          </header>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
