"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pager, SearchBox, SortChoice } from "@/components/blocks/ListTools";
import {
  activityHref,
  type ActivityQuery,
  type ActivitySort,
} from "@/lib/flow-steps";
import { BLOCK_WORDS } from "@/lib/generated/platform-contracts/block-rules";
import { SPACING } from "@/lib/spacing";

/** Activity's sort choices, in the platform's words: newest first (today's), then oldest. */
export function activitySorts(): { value: ActivitySort; label: string }[] {
  return [
    { value: "newest", label: BLOCK_WORDS.newestFirst },
    { value: "oldest", label: BLOCK_WORDS.oldestFirst },
  ];
}

/**
 * Activity's search box and sort, drawn from its address (no router of its
 * own, so a test draws it): the search box always ("Search runs"), its
 * search sent on Enter; the sort only when the platform counts more than 25
 * (`long`). A new search or sort goes to page 1. Each change is a new address
 * (`activityHref`), which the server reads and sends on to the platform.
 */
export function ActivityToolsView({
  query,
  long,
  onGo,
}: {
  query: ActivityQuery;
  long: boolean;
  onGo: (href: string) => void;
}) {
  const [text, setText] = useState(query.q ?? "");
  // A new search or sort: the filters kept, on page 1.
  const rest = {
    ...(query.flowId ? { flowId: query.flowId } : {}),
    ...(query.outcome ? { outcome: query.outcome } : {}),
    ...(query.since ? { since: query.since } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
  };
  const searched = (q: string) =>
    activityHref({ ...rest, ...(q.trim() ? { q: q.trim() } : {}) });
  return (
    <div className={`flex flex-col ${SPACING.inner.gap}`}>
      <form
        role="search"
        action="/account/runs"
        onSubmit={(event) => {
          event.preventDefault();
          onGo(searched(text));
        }}
      >
        <SearchBox
          hint={BLOCK_WORDS.searchRuns}
          name="q"
          value={text}
          onChange={(next) => {
            setText(next);
            // Emptied with ×: every run again.
            if (!next && query.q) onGo(searched(""));
          }}
          testId="activity-search"
        />
      </form>
      {long ? (
        <SortChoice
          choices={activitySorts()}
          value={query.sort ?? "newest"}
          onChange={(next) =>
            onGo(
              activityHref({
                ...rest,
                ...(query.q ? { q: query.q } : {}),
                sort: next as ActivitySort,
              }),
            )
          }
          testId="activity-sort"
        />
      ) : null}
    </div>
  );
}

/**
 * Activity's search and sort, live (backend ADR-0048 amendment 1): `q`,
 * `sort` and `page` kept in the address, the outcome and the time with
 * them; the server sends them all on to the platform.
 */
export function ActivityControls({
  query,
  long,
}: {
  query: ActivityQuery;
  long: boolean;
}) {
  const router = useRouter();
  return (
    <ActivityToolsView
      query={query}
      long={long}
      onGo={(href) => router.push(href)}
    />
  );
}

/** Activity's pager, under its runs: Previous, "Page {n} of {total}", Next. */
export function ActivityPager({
  query,
  pages,
}: {
  query: ActivityQuery;
  pages: number;
}) {
  const router = useRouter();
  return (
    <Pager
      page={Math.min(query.page ?? 1, pages)}
      pages={pages}
      onPage={(page) => router.push(activityHref({ ...query, page }))}
      testId="activity-pager"
    />
  );
}
