"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RunStats } from "@/lib/automations";
import { localMidnight, todayHref } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";

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
 * answers each says the em dash; a read that fails says "Unavailable", and the
 * rest of the dashboard still shows.
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

  return (
    <div data-testid="home-stats" className="mt-3 grid grid-cols-3 gap-3">
      {TILES.map((tile) => {
        const value =
          stats === "unavailable"
            ? TODAY_UNAVAILABLE
            : stats === null
              ? "—"
              : String(stats[tile.count]);
        const quiet = stats === null || stats === "unavailable";
        return (
          <Link
            key={tile.label}
            prefetch={false}
            href={
              since
                ? todayHref(since, "outcome" in tile ? tile.outcome : undefined)
                : "/account/runs"
            }
            data-testid={`today-${tile.label}`}
            className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-4 py-3 transition hover:bg-[var(--surface-hover)]"
          >
            <span
              data-testid={`today-stat-${tile.label}`}
              className={`${stats === "unavailable" ? "text-sm" : "text-2xl"} font-medium ${quiet ? "text-[var(--muted)]" : tile.tone || "text-[var(--text)]"}`}
            >
              {value}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {tile.label}
              <span className="sr-only">, see these runs in Activity</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
