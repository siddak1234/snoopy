"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { Pager, SearchBox, SortChoice } from "@/components/blocks/ListTools";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { Group } from "@/components/dashboard/Group";
import { PageRow } from "@/components/dashboard/PageRow";
import { LIST_CARD } from "@/components/dashboard/SectionRows";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import type { AutomationItems, ListItemsResponse } from "@/lib/automations";
import { fill, pageCount, search } from "@/lib/block-sort";
import { EMAIL_UNAVAILABLE } from "@/lib/flow-email";
import {
  ALL_GROUPS,
  groupChoices,
  groupItems,
  itemLine,
  itemOrders,
  itemPath,
  noneYet,
  pageGroups,
  uploadLabel,
  type ItemOrder,
} from "@/lib/flow-items";
import {
  BLOCK_SEARCH,
  BLOCK_WORDS,
} from "@/lib/generated/platform-contracts/block-rules";
import { platformApiJson } from "@/lib/platform-api";
import { RUN_REREAD_MS } from "@/lib/run-progress";
import { SPACING } from "@/lib/spacing";
import { UploadItemCard } from "./UploadItemCard";

/**
 * A flow's items on its page (Round 19, plan §5.1; backend ADR-0046) — the
 * page's whole body since build 28 (plan §3; the owner's build 28 items 2 and
 * 3: no dashboard, no steps), a run of such a flow naming an item. Headed by
 * the flow's own word for them (`items.words`' plural), with "Upload {one}"
 * for an owner or admin (`canManage`), which opens the upload card; then, for
 * a flow with a `groupField`, its filter — the website's drop-down
 * (`Dropdown`), "All {field, many}" first and each value the items carry A–Z
 * (`groupChoices`), named by the field's title — and the items `groupItems`
 * gives for the choice: every group A–Z under its header, or the chosen one's
 * alone; rows A–Z, each its title and its line (`itemLine`: how many runs and
 * the best score, "Reading…" or "Couldn't read"), opening its page. None yet:
 * the one empty row; a list the platform could not answer: "Unavailable" in
 * that row, as Step 5's addresses say it — never "None yet" for a flow that
 * has items. A search box over them always, and on more than 25, sort and
 * pages (`FlowItemsList`; backend ADR-0048 amendment 1). ~~Grouped in the
 * options' order, newest first, under the steps~~ until build 28.
 *
 * **Read again while one is being read**, every 2 s as a run's page is
 * (`RUN_REREAD_MS`), one read at a time, through `/api/platform`; a read that
 * fails leaves the list as it was. An item just made joins the list at once,
 * "Reading…", and the page is drawn again.
 */
export function FlowItems({
  workspaceId,
  subscriptionId,
  declared,
  initial,
  canManage,
}: {
  workspaceId: string;
  subscriptionId: string;
  /** The items the version the flow runs declares. */
  declared: AutomationItems;
  /** The flow's items, or null when they could not be read. */
  initial: ListItemsResponse | null;
  /** An owner or admin: Upload is theirs. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again: its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setList(initial);
  }
  const [reads, setReads] = useState(0);
  const [uploading, setUploading] = useState(false);
  const reading =
    list?.items.some((item) => item.status === "reading") ?? false;

  useEffect(() => {
    if (!reading) return;
    let live = true;
    const timer = setTimeout(() => {
      platformApiJson<ListItemsResponse>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/subscriptions/${encodeURIComponent(subscriptionId)}/items`,
      )
        .then((answer) => {
          if (live) setList(answer);
        })
        // A read that fails leaves the list as it was; the next one may answer.
        .catch(() => undefined)
        .finally(() => {
          if (live) setReads((count) => count + 1);
        });
    }, RUN_REREAD_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [reading, reads, workspaceId, subscriptionId]);

  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<ItemOrder>("az");
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState(ALL_GROUPS);

  return (
    <Group
      title={declared.words.plural}
      titleId="flow-items-title"
      action={
        canManage ? (
          <Button
            variant="secondary"
            size="sm"
            data-testid="item-upload-open"
            className={`inline-flex items-center ${SPACING.inner.gap}`}
            onClick={() => setUploading(true)}
          >
            <UploadSimpleIcon size={20} aria-hidden />
            {uploadLabel(declared.words)}
          </Button>
        ) : undefined
      }
    >
      <FlowItemsList
        subscriptionId={subscriptionId}
        declared={declared}
        items={list?.items ?? null}
        query={query}
        onQuery={(next) => {
          setQuery(next);
          setPage(1);
        }}
        order={order}
        onOrder={(next) => {
          setOrder(next);
          setPage(1);
        }}
        page={page}
        onPage={setPage}
        chosen={chosen}
        onChoose={(next) => {
          setChosen(next);
          setPage(1);
        }}
      />
      {uploading ? (
        <UploadItemCard
          workspaceId={workspaceId}
          subscriptionId={subscriptionId}
          declared={declared}
          saved={list?.choices ?? {}}
          onClose={() => setUploading(false)}
          onMade={(item) => {
            setUploading(false);
            setList((current) => ({
              choices: current?.choices ?? {},
              items: [
                item,
                ...(current?.items ?? []).filter(
                  (other) => other.id !== item.id,
                ),
              ],
            }));
            router.refresh();
          }}
        />
      ) : null}
    </Group>
  );
}

/**
 * The items themselves, drawn from what the page holds (no hooks of its
 * own but the drop-downs'): the search box, always ("Search {items}", the
 * flow's word for many, in lower case); the group filter; on a list of more
 * than 25, the sort ("A to Z", today's, or "Newest first", the platform's)
 * and the pages; then each group, its rows one card of divided `PageRow`s.
 * A search that finds nothing says so in the list's place.
 */
export function FlowItemsList({
  subscriptionId,
  declared,
  items,
  query,
  onQuery,
  order,
  onOrder,
  page,
  onPage,
  chosen,
  onChoose,
}: {
  subscriptionId: string;
  declared: AutomationItems;
  /** The flow's items, or null when they could not be read. */
  items: ListItemsResponse["items"] | null;
  query: string;
  onQuery: (query: string) => void;
  order: ItemOrder;
  onOrder: (order: ItemOrder) => void;
  page: number;
  onPage: (page: number) => void;
  chosen: string;
  onChoose: (chosen: string) => void;
}) {
  const filterId = useId();
  const groupField = declared.fields.find(
    (field) => field.key === declared.groupField && field.control === "select",
  );
  const all = items ?? [];
  const choices =
    groupField && all.length > 0 ? groupChoices(all, groupField) : [];
  // A group no item carries any more (one archived) is All again.
  const shown = choices.some((choice) => choice.value === chosen)
    ? chosen
    : ALL_GROUPS;
  const size = BLOCK_SEARCH.pageSize;
  const long = all.length > size;
  const found = search(all, query, (item) => [item.title]);
  const groups = groupItems(found, groupField, shown, long ? order : "az");
  const drawn = long ? pageGroups(groups, page, size) : groups;
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className={`flex flex-col ${SPACING.inner.gap}`}>
      {items ? (
        <SearchBox
          hint={fill(BLOCK_WORDS.searchItems, {
            items: declared.words.plural.toLocaleLowerCase("en-US"),
          })}
          value={query}
          onChange={onQuery}
          testId="flow-items-search"
        />
      ) : null}
      {(groupField && choices.length > 0) || long ? (
        <div className={`flex flex-wrap ${SPACING.inner.gap}`}>
          {groupField && choices.length > 0 ? (
            <div className="flex">
              <span id={`${filterId}-label`} className="sr-only">
                {groupField.title}
              </span>
              <Dropdown
                id={filterId}
                look="pill"
                labelledBy={`${filterId}-label`}
                options={choices}
                value={shown}
                onChange={onChoose}
                testId="flow-items-filter"
              />
            </div>
          ) : null}
          {long ? (
            <SortChoice
              choices={itemOrders(BLOCK_WORDS)}
              value={order}
              onChange={(next) => onOrder(next as ItemOrder)}
              testId="flow-items-sort"
            />
          ) : null}
        </div>
      ) : null}
      {drawn.length === 0 ? (
        <EmptyRow
          band={false}
          text={
            !items
              ? EMAIL_UNAVAILABLE
              : all.length > 0 && query.trim()
                ? fill(BLOCK_WORDS.noMatch, { query: query.trim() })
                : noneYet(declared.words)
          }
        />
      ) : (
        <div
          data-testid="flow-items"
          className={`flex flex-col ${SPACING.group.gap}`}
        >
          {drawn.map((group, at) => (
            <div key={group.title ?? `none-${at}`}>
              {group.title && shown === ALL_GROUPS ? (
                <SectionTitle as="h3" testId="flow-item-group">
                  {group.title}
                </SectionTitle>
              ) : null}
              <ul
                className={
                  group.title && shown === ALL_GROUPS
                    ? `${SPACING.title.top} ${LIST_CARD}`
                    : LIST_CARD
                }
              >
                {group.items.map((item) => (
                  <li key={item.id}>
                    <PageRow
                      href={itemPath(subscriptionId, item.id)}
                      testId={`flow-item-${item.id}`}
                      boxed={false}
                      end={
                        <span
                          className={`shrink-0 text-sm ${item.status === "failed" ? "text-[var(--warning-text)]" : "text-[var(--muted)]"}`}
                        >
                          {itemLine(item, declared.runWords)}
                        </span>
                      }
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                        {item.title}
                      </span>
                    </PageRow>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {long ? (
        <Pager
          page={Math.min(Math.max(1, page), pageCount(count, size))}
          pages={pageCount(count, size)}
          onPage={onPage}
          testId="flow-items-pager"
        />
      ) : null}
    </div>
  );
}
