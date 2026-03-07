import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return <>{children}</>;
}
