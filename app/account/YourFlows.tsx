"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { fill } from "@/lib/block-sort";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { FlowCard } from "@/components/dashboard/FlowCard";
import { Group } from "@/components/dashboard/Group";
import { SearchBox } from "@/components/blocks/ListTools";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import type { ListItemsResponse } from "@/lib/automations";
import { BLOCK_WORDS } from "@/lib/generated/platform-contracts/block-rules";
import { itemStatusLine, noneYet, uploadLabel } from "@/lib/flow-items";
import { flowPath } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";
import { FROM_FLOW, FROM_ITEM, RUN_REREAD_MS } from "@/lib/run-progress";
import { SPACING } from "@/lib/spacing";
import type { Department } from "./flows/departments";
import { RunStart } from "./flows/RunStart";
import { UploadItemCard } from "./flows/UploadItemCard";
import {
  ALL,
  DEPARTMENT,
  YOUR_FLOWS,
  departmentChoices,
  jobChoices,
  newestReady,
  shownFlows,
  type HomeFlow,
} from "./home-flows";

/** What the search box hints: "Search flows", in the platform's words. */
const SEARCH_FLOWS = fill(BLOCK_WORDS.searchItems, { items: "flows" });

/**
 * Home's YOUR FLOWS, drawn (the owner's build 34 F5; `homeFlows`), as the
 * owner's builds 37 and 39, item 8 lays it out: "Your flows — on the right
 * hand side department select drop down / Search bar / Department name in
 * sorted order / Quick access cards … No more arround drop downs.
 * Individual quick access cards." — the title and, at its right, the
 * department drop-down (`departmentChoices`: "All departments", then each
 * department A–Z); under it the search box, "Search flows", by name
 * whatever its case (`shownFlows`; nothing found, the platform's
 * `noMatch`); then each department's name and its flows, a card each,
 * always open: the flow card, compact (`FlowCard` `compact`: its icon and
 * name in one row, no description and no Live — the owner's build 41, item
 * 14: "Just the logo, title, then the buttons and items. We do not need the
 * description and live"), then directly what starts its run here, in two
 * rows (the owner's build 42, item 16: "It looks like big squares for a
 * quick access"): the icon and name, then the run's start, compact
 * (`RunStart` `compact`) —
 *
 * - a flow without items: its run's start, its run's page opening from its
 *   flow (back: the flow's page);
 * - a flow with items, for an owner or admin: its items, read as Home opens,
 *   each flow's alone ("Unavailable" in its place); the job drop-down, a
 *   pill at the right of the name's row, chosen already on the newest ready
 *   job (`newestReady`; the owner's item 5), still changeable, and the run's
 *   start, its run's page opening from that job (back: the job, then the
 *   flow). None ready: "No jobs yet." and "Upload job" in one row (the
 *   owner's item 2: "it should show a configure in the home screen.
 *   Basically upload a job"), the flow page's own upload card; the job is
 *   then read again every 2 s, on Home, until it is ready;
 * - any other flow (a member's flow with items, one not answering): Open,
 *   to the flow's page.
 *
 * ~~The job drop-down a row of its own under its title~~ until build 42.
 *
 * ~~One card of divided rows, each opening in place with a caret; a flow's
 * items read when it was opened; "Choose" a job first~~ until builds 37 and
 * 39 (its item 3: the cut-off "Choose" went with the rows).
 */
export function YourFlows({
  workspaceId,
  departments,
}: {
  workspaceId: string;
  departments: Department<HomeFlow>[];
}) {
  const pickId = useId();
  const [department, setDepartment] = useState(ALL);
  const [query, setQuery] = useState("");
  const shown = shownFlows(departments, department, query);
  return (
    <Group
      title={YOUR_FLOWS}
      titleId="your-flows-title"
      testId="home-your-flows"
      action={
        <div className="flex">
          <span id={`${pickId}-label`} className="sr-only">
            {DEPARTMENT}
          </span>
          <Dropdown
            id={pickId}
            look="pill"
            labelledBy={`${pickId}-label`}
            options={departmentChoices(departments)}
            value={department}
            onChange={setDepartment}
            testId="home-department"
          />
        </div>
      }
    >
      <div className={`flex flex-col ${SPACING.group.gap}`}>
        <SearchBox
          hint={SEARCH_FLOWS}
          value={query}
          onChange={setQuery}
          testId="home-search"
        />
        {shown.length === 0 ? (
          <EmptyRow
            band={false}
            text={fill(BLOCK_WORDS.noMatch, { query: query.trim() })}
          />
        ) : (
          shown.map(({ department: name, id, entries }) => (
            <section key={id} aria-labelledby={`home-${id}`}>
              <SectionTitle as="h3" id={`home-${id}`}>
                {name}
              </SectionTitle>
              <ul
                className={`${SPACING.title.top} grid ${SPACING.group.gap} sm:grid-cols-2`}
              >
                {entries.map((flow) => (
                  <li key={flow.id} className="min-w-0">
                    <HomeFlowCard workspaceId={workspaceId} flow={flow} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Group>
  );
}

/** Home's flow card, compact: its icon and name (and `aside`), then `children`. */
function HomeCard({
  flow,
  aside,
  children,
}: {
  flow: HomeFlow;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FlowCard
      icon={flow.icon}
      name={flow.name}
      compact
      heading="h4"
      aside={aside}
      testId={`home-flow-${flow.id}`}
    >
      {children}
    </FlowCard>
  );
}

/** One flow's card: the flow card, then its run's start, or Open. */
function HomeFlowCard({
  workspaceId,
  flow,
}: {
  workspaceId: string;
  flow: HomeFlow;
}) {
  // A flow with items draws its card itself: its job drop-down is in its head.
  if (flow.startable && flow.items)
    return (
      <ItemRunStart workspaceId={workspaceId} flow={flow} items={flow.items} />
    );
  return (
    <HomeCard flow={flow}>
      <div>
        {!flow.startable ? (
          <Button
            href={flowPath(flow.id)}
            variant="secondary"
            size="sm"
            prefetch={false}
            aria-label={`Open ${flow.name}`}
          >
            Open
          </Button>
        ) : (
          <RunStart
            workspaceId={workspaceId}
            subscriptionId={flow.id}
            runInput={flow.runInput}
            live
            available
            canGoLive
            initialKey={flow.initialKey}
            from={FROM_FLOW}
            compact
          />
        )}
      </div>
    </HomeCard>
  );
}

/**
 * A flow with items, its card drawn here: its items, read once as Home opens
 * and again every 2 s while one is being read (as the flow page's list is);
 * the ready ones in a drop-down pill under their group (`jobChoices`), at
 * the right of the card's name row (`aside`, named by the flow's word for
 * one, for screen readers), the newest chosen already (`newestReady`); the
 * run's start for the job chosen, compact, under a key of its own. A read
 * that fails says "Unavailable", inside the card; none ready says the flow's
 * own "No jobs yet." — with each job uploaded here and still being read, its
 * line ("Reading…") — and its "Upload job" beside it, the flow page's upload
 * card (`UploadItemCard`) under them.
 */
function ItemRunStart({
  workspaceId,
  flow,
  items: declared,
}: {
  workspaceId: string;
  flow: HomeFlow;
  /** The flow's items declaration: its words and its group field. */
  items: NonNullable<HomeFlow["items"]>;
}) {
  const pickId = useId();
  const [list, setList] = useState<ListItemsResponse | "failed">();
  const [reads, setReads] = useState(0);
  const [itemId, setItemId] = useState("");
  const [runKey, setRunKey] = useState(flow.initialKey);
  const [uploading, setUploading] = useState(false);
  const path = `/v1/workspaces/${encodeURIComponent(workspaceId)}/subscriptions/${encodeURIComponent(flow.id)}/items`;
  const reading =
    typeof list === "object" &&
    list.items.some((item) => item.status === "reading" && !item.archivedAt);

  // Read as Home opens: each flow's alone, so one that fails costs only its card.
  useEffect(() => {
    let live = true;
    platformApiJson<ListItemsResponse>(path)
      .then((answer) => {
        if (live) setList(answer);
      })
      .catch(() => {
        if (live) setList("failed");
      });
    return () => {
      live = false;
    };
  }, [path]);

  // A job being read is read again every 2 s, on Home, until it is ready.
  useEffect(() => {
    if (!reading) return;
    let live = true;
    const timer = setTimeout(() => {
      platformApiJson<ListItemsResponse>(path)
        .then((answer) => {
          if (live) setList(answer);
        })
        // A read that fails leaves the card as it was; the next one may answer.
        .catch(() => undefined)
        .finally(() => {
          if (live) setReads((count) => count + 1);
        });
    }, RUN_REREAD_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [reading, reads, path]);

  if (list === undefined)
    return (
      <HomeCard flow={flow}>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </HomeCard>
    );
  if (list === "failed")
    return (
      <HomeCard flow={flow}>
        <p className="text-sm text-[var(--muted)]">Unavailable</p>
      </HomeCard>
    );
  const choices = jobChoices(list.items, declared.groupField);
  // The job chosen, else the newest ready one: the owner's item 5.
  const chosen = choices.some((choice) => choice.value === itemId)
    ? itemId
    : newestReady(list.items);
  if (choices.length === 0) {
    const read = list.items.filter(
      (item) => item.status === "reading" && !item.archivedAt,
    );
    return (
      <HomeCard flow={flow}>
        <div
          data-testid={`home-empty-${flow.id}`}
          className={`flex flex-wrap items-center ${SPACING.inner.gap}`}
        >
          {read.length > 0 ? (
            <ul data-testid={`home-reading-${flow.id}`}>
              {read.map((item) => (
                <li key={item.id} className="text-sm text-[var(--text)]">
                  {item.title}{" "}
                  <span className="text-[var(--muted)]">
                    · {itemStatusLine(item)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {noneYet(declared.words)}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            data-testid={`home-upload-${flow.id}`}
            className={`inline-flex items-center ${SPACING.inner.gap}`}
            onClick={() => setUploading(true)}
          >
            <UploadSimpleIcon size={20} aria-hidden />
            {uploadLabel(declared.words)}
          </Button>
        </div>
        {uploading ? (
          <UploadItemCard
            workspaceId={workspaceId}
            subscriptionId={flow.id}
            declared={declared}
            saved={list.choices}
            onClose={() => setUploading(false)}
            onMade={(item) => {
              setUploading(false);
              setList({
                choices: list.choices,
                items: [
                  item,
                  ...list.items.filter((other) => other.id !== item.id),
                ],
              });
            }}
          />
        ) : null}
      </HomeCard>
    );
  }
  return (
    <HomeCard
      flow={flow}
      aside={
        // The department drop-down's pattern: a pill named by a word for screen readers.
        <div className="flex">
          <span id={`${pickId}-label`} className="sr-only">
            {declared.words.singular}
          </span>
          <Dropdown
            id={pickId}
            look="pill"
            labelledBy={`${pickId}-label`}
            options={choices}
            value={chosen}
            onChange={(value) => {
              setItemId(value);
              setRunKey(`run-${crypto.randomUUID()}`);
            }}
            testId={`home-job-${flow.id}`}
          />
        </div>
      }
    >
      <RunStart
        key={chosen}
        workspaceId={workspaceId}
        subscriptionId={flow.id}
        runInput={flow.runInput}
        live
        available
        canGoLive
        initialKey={runKey}
        itemId={chosen}
        from={FROM_ITEM}
        compact
      />
    </HomeCard>
  );
}
