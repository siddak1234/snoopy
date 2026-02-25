import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthOptions } from "@/lib/auth";

export default async function AccountPage() {
  const session = await getServerSession(getAuthOptions());

  if (!session?.user?.email) {
    redirect("/login");
  }

  const name = session.user.name ?? "";
  const firstName = name.split(" ")[0] || "there";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 md:py-16">
        {/* Welcome header */}
        <header className="space-y-2 text-center">
          <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Automa8x Workspace
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
          <p className="text-sm text-slate-400 md:text-base">
            Your automation workspace
          </p>
        </header>

        {/* Top cards: profile + quick actions */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
          {/* Profile card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/70 p-5 shadow-xl shadow-emerald-500/10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-emerald-500/40 via-cyan-500/30 to-sky-500/40">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? session.user.email ?? "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-50">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {session.user.name ?? session.user.email}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {session.user.email}
                </p>
                <p className="mt-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Signed in with Google
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="space-y-1 text-xs text-slate-400">
                <p className="font-medium text-slate-300">Account status</p>
                <p>Workspace owner access • Unlimited automations (dev)</p>
              </div>
              <form
                action="/api/auth/signout?callbackUrl=/"
                method="post"
                className="shrink-0"
              >
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-100 shadow-sm shadow-slate-900/60 transition hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-100"
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-200">
                Quick actions
              </h2>
              <p className="text-xs text-slate-500">
                Jump back into your automations
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Automation Builder */}
              <QuickActionCard
                href="/automation-builder"
                label="Create Automation"
                description="Build AI workflows and triggers"
                accent="from-emerald-500/40 via-cyan-500/40 to-sky-500/40"
              >
                <WorkflowIcon />
              </QuickActionCard>

              {/* My Automations */}
              <QuickActionCard
                href="#"
                label="My Automations"
                description="View and manage your workflows"
                accent="from-sky-500/30 via-indigo-500/30 to-fuchsia-500/30"
              >
                <LayersIcon />
              </QuickActionCard>

              {/* Request a Solution */}
              <QuickActionCard
                href="/contact"
                label="Request a Custom Solution"
                description="Tell us what you want automated"
                accent="from-violet-500/35 via-fuchsia-500/35 to-rose-500/35"
              >
                <ChatIcon />
              </QuickActionCard>
            </div>
          </div>
        </section>

        {/* Automations section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium text-slate-200">
              Your Automations
            </h2>
            <p className="text-xs text-slate-500">
              Orchestrate workflows across your stack
            </p>
          </div>

          {/* Empty state for now */}
          <div className="flex justify-center">
            <div className="w-full max-w-md rounded-2xl border border-dashed border-white/15 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/70 p-6 text-center shadow-xl shadow-cyan-500/10 backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <span className="text-lg">✧</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                No automations yet
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Create your first workflow using the builder and see it appear
                here.
              </p>
              <div className="mt-4 flex justify-center">
                <Link
                  href="/automation-builder"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
                >
                  Launch Automation Builder
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type QuickActionCardProps = {
  href: string;
  label: string;
  description: string;
  accent: string;
  children: React.ReactNode;
};

function QuickActionCard({
  href,
  label,
  description,
  accent,
  children,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/50 to-slate-800/60 p-4 shadow-lg shadow-slate-950/60 backdrop-blur-xl transition-transform transition-shadow hover:scale-[1.02] hover:border-white/20 hover:shadow-emerald-500/20`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${accent} text-slate-50 shadow-inner shadow-slate-900/60`}
        >
          {children}
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="mt-4 flex items-center text-[11px] font-medium text-emerald-300">
        <span className="mr-1 h-1 w-1 rounded-full bg-emerald-400" />
        <span className="transition group-hover:translate-x-0.5">
          Open workspace
        </span>
      </div>
    </Link>
  );
}

function WorkflowIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 6h4v4H5V6Zm10 0h4v4h-4V6ZM5 14h4v4H5v-4Zm10 0h4v4h-4v-4Z"
        className="fill-current/60"
      />
      <path
        d="M9 8h3a2 2 0 0 1 2 2v4m-4 0h3"
        className="stroke-current"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 4 4 8l8 4 8-4-8-4Z"
        className="fill-current/70"
      />
      <path
        d="m4 12 8 4 8-4M4 16l8 4 8-4"
        className="stroke-current"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 5h12a2 2 0 0 1 2 2v6.5A2.5 2.5 0 0 1 17.5 16H14l-3.5 3-1-3H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        className="fill-current/65"
      />
      <path
        d="M9 9h6M9 12h3"
        className="stroke-slate-100"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
