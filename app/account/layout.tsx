import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";
import { DashboardSidebar, DashboardHeader } from "@/components/dashboard/DashboardNav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(getAuthOptions());

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">
        <header className="mb-6">
          <DashboardHeader />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
