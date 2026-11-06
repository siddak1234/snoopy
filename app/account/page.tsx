import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/ssr/FlowArrow";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { getAppSession } from "@/lib/app-session";
import {
  listApprovals,
  listAutomations,
  listSubscriptions,
} from "@/lib/automations";
import {
  PlatformNotConfiguredError,
  PlatformServerError,
  newIdempotencyKey,
} from "@/lib/platform-server";
import {
  administers,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { Group } from "@/components/dashboard/Group";
import { Button } from "@/components/ui/Button";
import { GROUP_BAND, ROW, SPACING } from "@/lib/spacing";
import { homeFlows, YOUR_FLOWS } from "./home-flows";
import { TodayTiles } from "./TodayTiles";
import { YourFlows } from "./YourFlows";

/**
 * The dashboard's own reads, each a figure of its own (register F54): the
 * workspace's flows, for YOUR FLOWS, named and put under their department
 * from the catalog (`homeFlows`); the catalog, whose `subscribed` says
 * whether this workspace has set any flow up, ever; and the approvals
 * waiting, for the banner — with the person's role, which an item's run
 * start needs (~~the recent runs~~ until build 34's F5). `null` when no
 * workspace is active, so nothing is claimed about one. Today's counts are
 * the browser's own read (`TodayTiles`): "today" is a local idea.
 *
 * Each figure stands alone: one the platform refuses or cannot answer says so
 * in its place and the rest still show, rather than one read taking the whole
 * dashboard with it. A session that ended is not a figure's to absorb, so it
 * goes to the account area's boundary as every other page's does. It reads
 * only what it draws (the app's S31): ~~the subscriptions, this month's run
 * tally, the connections and the teams, for Run a flow and the Workspace
 * overview~~ until Build 22.
 */
async function readHome(workspaceId: string | undefined) {
  if (!workspaceId) return null;
  const [subscriptions, catalog, pending, role] = await Promise.all([
    figure(() => listSubscriptions(workspaceId)),
    figure(() => listAutomations(workspaceId)),
    figure(() => listApprovals(workspaceId, "pending")),
    roleInWorkspace(workspaceId),
  ]);
  return {
    workspaceId,
    // Either list unanswered: the section says "Unavailable" in its place.
    flows:
      subscriptions && catalog
        ? homeFlows(
            subscriptions.subscriptions,
            catalog.automations,
            administers(role),
            () => newIdempotencyKey("run"),
          )
        : null,
    // With no flow set up, ever — the catalog's flag, so a catalog that could
    // not be read claims nothing — the first run takes the place of the
    // buttons and the runs below (the app's HomeFirstRun).
    firstRun:
      catalog !== null &&
      !catalog.automations.some((entry) => entry.subscribed),
    // What Approvals lists; a refused read draws no banner, since the banner
    // says something waits and that is not known.
    pending: pending?.approvals.length ?? 0,
  };
}

async function figure<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) return null;
    if (error instanceof PlatformServerError && error.status !== 401) {
      return null;
    }
    throw error;
  }
}

function getFirstName(name?: string | null): string | null {
  if (!name?.trim()) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

/**
 * The dashboard (Build 22, W1; the owner's build 21 item 1: "Remove run a flow
 * section. We did not add thus. / Remove overflow, it should be the 3 icons
 * for today with the run types / Then add a flow and flow buttons / Then
 * recent runs. / I dont want want flows integrations, connect integrations,
 * view teams, or run a flow. / Recent runs is fine") — the app's Home on the
 * website (D5, the session's suggestion the owner approved 21:12Z). Top to
 * bottom, under the greeting:
 *
 * 1. **Today** — Runs, Successes, Failures since the browser's midnight, each
 *    opening Activity for them (`TodayTiles`);
 * 2. the approvals banner, only while something waits — right after Today
 *    (D6, the session's suggestion the owner approved), in the app's words;
 * 3. **Add a flow** and **Flows**, both to Flows, the website's one page for
 *    adding and for the flows added;
 * 4. **YOUR FLOWS** (the owner's build 34 F5), only while the workspace has
 *    a live flow — its department drop-down and search, then each flow a
 *    card of its own, always open, with its run's first step and Start run
 *    (`YourFlows`; the owner's builds 37 and 39, item 8). ~~Recent runs and
 *    See all, four rows~~ until build 34; ~~a row per flow that opened in
 *    place~~ until builds 37 and 39.
 *
 * With no flow set up, ever, the first run takes the place of 3 and 4 — the
 * app's words, and its one way in. ~~Run a flow, Quick actions (Browse flows,
 * View teams, Connect integration), the Workspace overview and Get started~~
 * until Build 22 ("overflow" is the overview: the session's D4, approved by
 * the owner).
 */
export default async function AccountDashboardPage() {
  const session = await getAppSession();
  const firstName = getFirstName(session?.user?.name);
  const greeting = firstName ? `Welcome, ${firstName}!` : "Welcome back!";

  const activeWorkspaceId = session
    ? await resolveActiveWorkspaceId(session)
    : undefined;
  const home = session ? await readHome(activeWorkspaceId) : null;

  return (
    <SectionCard
      title="Dashboard"
      greeting={greeting}
      subheader="Here's what's happening in your workspace."
    >
      {home ? (
        <Group title="Today" titleId="today-title" testId="home-today">
          <TodayTiles workspaceId={home.workspaceId} />
        </Group>
      ) : (
        <EmptyRow text="No workspace is active yet." />
      )}

      {home && home.pending > 0 ? (
        <div className={GROUP_BAND}>
          <Link
            prefetch={false}
            href="/account/approvals"
            data-testid="home-approvals"
            className={`flex items-center ${SPACING.inner.gap} rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--chip-bg)] ${ROW} transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]`}
          >
            <HandPalmIcon
              aria-hidden
              size={24}
              className="shrink-0 text-[var(--accent-strong)]"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-[var(--text)]">
                {home.pending}{" "}
                {home.pending === 1 ? "item needs" : "items need"} your review
              </span>
              <span className="text-xs text-[var(--muted)]">
                Exceptions your agents held for judgment
              </span>
            </span>
            <CaretRightIcon
              aria-hidden
              size={16}
              className="shrink-0 text-[var(--muted)]"
            />
          </Link>
        </div>
      ) : null}

      {home?.firstRun ? (
        <EmptyRow
          icon={<SparkleIcon size={32} />}
          title="Nothing automated. Yet."
          text="Add a prebuilt flow and your first agent is running in minutes — no building required."
          action={
            <Button
              href="/account/flows"
              prefetch={false}
              className={`inline-flex items-center ${SPACING.inner.gap}`}
            >
              <PlusIcon aria-hidden size={20} />
              Add a flow
            </Button>
          }
        />
      ) : home ? (
        <>
          <div data-testid="home-quick-actions" className={GROUP_BAND}>
            <div
              className={`grid grid-cols-2 ${SPACING.inner.gap} sm:max-w-md`}
            >
              <Button
                href="/account/flows"
                prefetch={false}
                className={`inline-flex items-center justify-center ${SPACING.inner.gap}`}
              >
                <PlusIcon aria-hidden size={20} />
                Add a flow
              </Button>
              <Button
                href="/account/flows"
                variant="secondary"
                prefetch={false}
                className={`inline-flex items-center justify-center ${SPACING.inner.gap}`}
              >
                <FlowArrowIcon aria-hidden size={20} />
                Flows
              </Button>
            </div>
          </div>

          {/* YOUR FLOWS draws its own title, with its department
              drop-down beside it (the owner's builds 37 and 39, item 8). */}
          {home.flows === null ? (
            <Group
              title={YOUR_FLOWS}
              titleId="your-flows-title"
              testId="home-your-flows"
            >
              <p className="text-sm text-[var(--muted)]">Unavailable</p>
            </Group>
          ) : home.flows.length > 0 ? (
            <YourFlows
              workspaceId={home.workspaceId}
              departments={home.flows}
            />
          ) : null}
        </>
      ) : null}
    </SectionCard>
  );
}
