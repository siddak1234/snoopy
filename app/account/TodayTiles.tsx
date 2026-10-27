"use client";

import { useEffect, useState } from "react";
import { Tile } from "@/components/dashboard/Tile";
import type { RunStats } from "@/lib/automations";
import { localMidnight, todayHref } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";
import { SPACING } from "@/lib/spacing";

/** The tiles' words: the app's TODAY (its `toStatTiles`), and its unreadable figure. */
const TILES = [
  { label: "Runs", count: "total", tone: "" },
  {
    label: "Successes",
    count: "succeeded",
    outcome: "succeeded",
    tone: "text-[var(--success-text)]",
  },
  {
    label: "Failures",
    count: "failed",
    outcome: "failed",
    tone: "text-[var(--error-text)]",
  },
] as const;
export const TODAY_UNAVAILABLE = "Unavailable";

/**
 * The dashboard's Today (Build 22, W1; the owner's build 21 item 1: "it should
 * be the 3 icons for today with the run types"; the session's S27): three
 * tiles — Runs, Successes, Failures — counted by the platform from the
 * browser's own midnight (`run-stats?since=`, as the app's TODAY reads it:
 * "today" is a local idea, so it is read here, in the browser, through
 * `/api/platform`), each opening Activity from that midnight for its outcome.
 * The flow page's Dashboard tiles' look (`FlowDashboard`). Until the read
 * answers each says the em dash; a read that fails says "Unavailable" once,
 * in the tiles' place — as the app's TODAY does (its G6; D5's parity), not in
 * each of three tiles a third of a phone's card wide (the Build 22 review) —
 * and the rest of the dashboard still shows.
 */
export function TodayTiles({ workspaceId }: { workspaceId: string }) {
  const [since, setSince] = useState<string | null>(null);
  const [stats, setStats] = useState<
    RunStats["workspace"] | "unavailable" | null
  >(null);

  useEffect(() => {
    let live = true;
    const midnight = localMidnight(new Date());
    platformApiJson<RunStats>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/run-stats?since=${encodeURIComponent(midnight)}`,
    )
      .then((answer) => {
        if (live) setStats(answer.workspace);
      })
      .catch(() => {
        if (live) setStats("unavailable");
      })
      // The links carry the browser's midnight, which the server that drew
      // the page cannot know.
      .finally(() => {
        if (live) setSince(midnight);
      });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  if (stats === "unavailable")
    return (
      <p
        data-testid="home-stats-unavailable"
        className={`rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] ${SPACING.rowX.x} ${SPACING.rowY.y} text-sm text-[var(--muted)]`}
      >
        {TODAY_UNAVAILABLE}
      </p>
    );

  return (
    <div
      data-testid="home-stats"
      className={`grid grid-cols-3 ${SPACING.inner.gap}`}
    >
      {TILES.map((tile) => {
        const value = stats === null ? "—" : String(stats[tile.count]);
        const quiet = stats === null;
        return (
          <Tile
            key={tile.label}
            label={tile.label}
            value={value}
            testId={`today-stat-${tile.label}`}
            linkTestId={`today-${tile.label}`}
            tone={
              quiet ? "text-[var(--muted)]" : tile.tone || "text-[var(--text)]"
            }
            href={
              since
                ? todayHref(since, "outcome" in tile ? tile.outcome : undefined)
                : "/account/runs"
            }
            hint=", see these runs in Activity"
          />
        );
      })}
    </div>
  );
}
