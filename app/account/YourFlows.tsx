"use client";

import { useEffect, useId, useState } from "react";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { fill } from "@/lib/block-sort";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { FlowCard } from "@/components/dashboard/FlowCard";
import { Group } from "@/components/dashboard/Group";
import { SearchBox } from "@/components/blocks/ListTools";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { StatusPill } from "@/components/dashboard/StatusPill";
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
 * always open: the flow card (`FlowCard`: icon, name, description, Live),
 * then what starts its run here —
 *
 * - a flow without items: its run's fields and Start run (`RunStart`), its
 *   run's page opening from its flow (back: the flow's page);
 * - a flow with items, for an owner or admin: its items, read as Home opens,
 *   each flow's alone ("Unavailable" in its place); the job drop-down,
 *   chosen already on the newest ready job (`newestReady`; the owner's item
 *   5), still changeable, and the run form, its run's page opening from that
 *   job (back: the job, then the flow). None ready: "No jobs yet." and
 *   "Upload job" (the owner's item 2: "it should show a configure in the
 *   home screen. Basically upload a job"), the flow page's own upload card;
 *   the job is then read again every 2 s, on Home, until it is ready;
 * - any other flow (a member's flow with items, one not answering): Open,
 *   to the flow's page.
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

/** One flow's card: the flow card, then its run's start, or Open. */
function HomeFlowCard({
  workspaceId,
  flow,
}: {
  workspaceId: string;
  flow: HomeFlow;
}) {
  return (
    <FlowCard
      icon={flow.icon}
      name={flow.name}
      description={flow.description}
      aside={<StatusPill status="live" />}
      heading="h4"
      testId={`home-flow-${flow.id}`}
    >
      <div className={`border-t border-[var(--ring)] ${SPACING.group.pt}`}>
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
        ) : flow.items ? (
          <ItemRunStart
            workspaceId={workspaceId}
            flow={flow}
            items={flow.items}
          />
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
          />
        )}
      </div>
    </FlowCard>
  );
}

/**
 * A flow with items, on its card: its items, read once as Home opens and
 * again every 2 s while one is being read (as the flow page's list is); the
 * ready ones in a drop-down under their group (`jobChoices`), the newest
 * chosen already (`newestReady`); the run form for the job chosen, under a
 * key of its own. A read that fails says "Unavailable"; none ready says the
 * flow's own "No jobs yet." — with each job uploaded here and still being
 * read, its line ("Reading…") — and its "Upload job", the flow page's upload
 * card (`UploadItemCard`).
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
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  if (list === "failed")
    return <p className="text-sm text-[var(--muted)]">Unavailable</p>;
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
      <div className={`flex flex-col ${SPACING.inner.gap}`}>
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
        <div>
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
      </div>
    );
  }
  return (
    <div className={`flex flex-col ${SPACING.group.gap}`}>
      <div>
        <label
          id={`${pickId}-label`}
          htmlFor={pickId}
          className="block text-sm font-medium text-[var(--text)]"
        >
          {declared.words.singular}
        </label>
        <Dropdown
          id={pickId}
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
      />
    </div>
  );
}
