"use client";

import { useEffect, useState } from "react";
import { Tile } from "@/components/dashboard/Tile";
import type { RunStats } from "@/lib/automations";
import { platformApiJson } from "@/lib/platform-api";
import { SPACING } from "@/lib/spacing";
import { FLOW_STATS_REREAD_MS } from "@/lib/run-progress";

type Counts = RunStats["subscriptions"][number];

/**
 * A flow page's Dashboard (Build 21, spec A6; the owner's build 20 item 10:
 * "Dashboard items should be updated too", and item 12: "Now its dashboard of
 * the 3 runs, success, fails"): three tiles — Runs, Successes, Failures — over
 * every run of the flow, each opening Activity for it and that outcome.
 *
 * **Live** (the session's S30): read again every 5 s while a run of this flow
 * is pending or running, and each time the page is shown again, from the
 * platform's own tally (`readRunStats`, through `/api/platform`) — so a run
 * that ends changes the tiles without leaving the page. A read that fails
 * leaves the tiles as they were; the next one may answer. A draft has never
 * run: the em dash, never "0".
 */
export function FlowDashboard({
  workspaceId,
  subscriptionId,
  initial,
  draft,
}: {
  workspaceId: string;
  subscriptionId: string;
  /** The flow's counts as the page was drawn; null when it has no run yet. */
  initial: Counts | null;
  draft: boolean;
}) {
  const [counts, setCounts] = useState<Counts | null>(initial);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a Pause, a refresh): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setCounts(initial);
  }
  const [reads, setReads] = useState(0);
  const going = (counts?.pending ?? 0) + (counts?.running ?? 0) > 0;

  useEffect(() => {
    let live = true;
    const read = () =>
      platformApiJson<RunStats>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/run-stats`,
      )
        .then((stats) => {
          if (!live) return;
          setCounts(
            stats.subscriptions.find(
              (candidate) => candidate.subscriptionId === subscriptionId,
            ) ?? null,
          );
        })
        .catch(() => undefined)
        .finally(() => {
          if (live) setReads((count) => count + 1);
        });
    // Shown again — back to this tab, or this window in front: read again.
    const shown = () => {
      if (document.visibilityState === "visible") void read();
    };
    document.addEventListener("visibilitychange", shown);
    window.addEventListener("focus", shown);
    // One read at a time while a run goes on: the next waits for the last.
    const timer = going
      ? setTimeout(() => void read(), FLOW_STATS_REREAD_MS)
      : null;
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", shown);
      window.removeEventListener("focus", shown);
    };
  }, [workspaceId, subscriptionId, going, reads]);

  const value = (count: number | undefined) =>
    draft && !counts ? "—" : String(count ?? 0);
  const activity = `/account/runs?flow=${encodeURIComponent(subscriptionId)}`;
  const tiles = [
    { label: "Runs", value: value(counts?.total), href: activity, tone: "" },
    {
      label: "Successes",
      value: value(counts?.succeeded),
      href: `${activity}&status=succeeded`,
      tone: "text-[var(--success-text)]",
    },
    {
      label: "Failures",
      value: value(counts?.failed),
      href: `${activity}&status=failed`,
      tone: "text-[var(--error-text)]",
    },
  ];

  return (
    <div
      data-testid="flow-dashboard"
      className={`grid grid-cols-3 ${SPACING.inner.gap}`}
    >
      {tiles.map((tile) => (
        <Tile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          testId={`flow-stat-${tile.label}`}
          tone={
            tile.value === "—"
              ? "text-[var(--muted)]"
              : tile.tone || "text-[var(--text)]"
          }
          href={tile.href}
          hint=", see these runs in Activity"
        />
      ))}
    </div>
  );
}
