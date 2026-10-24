"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { Button } from "@/components/ui/Button";
import type { AutomationItems, ListItemsResponse } from "@/lib/automations";
import { EMAIL_UNAVAILABLE } from "@/lib/flow-email";
import {
  groupItems,
  itemLine,
  itemPath,
  noneYet,
  uploadLabel,
} from "@/lib/flow-items";
import { platformApiJson } from "@/lib/platform-api";
import { RUN_REREAD_MS } from "@/lib/run-progress";
import { UploadItemCard } from "./UploadItemCard";

/**
 * A flow's items on its page (Round 19, plan §5.1; backend ADR-0046), after
 * its numbered steps and in place of its run start form — a run of such a
 * flow names an item. Headed by the flow's own word for them ("Jobs"), with
 * "Upload job" for an owner or admin (`canManage`), which opens the upload
 * card; then the items, grouped by the flow's `groupField` in the order
 * `groupItems` gives, each row its title and its line (`itemLine`: how many
 * runs and the best score, "Reading…" or "Couldn't read"), opening its page.
 * None yet: the one empty row; a list the platform could not answer:
 * "Unavailable" in that row, as Step 5's addresses say it — never "None yet"
 * for a flow that has items.
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

  const groupField = declared.fields.find(
    (field) => field.key === declared.groupField && field.control === "select",
  );
  const groups = list ? groupItems(list.items, groupField) : [];

  return (
    <section aria-labelledby="flow-items-title" className="py-5">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="flow-items-title"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          {declared.words.plural}
        </h2>
        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            data-testid="item-upload-open"
            className="inline-flex items-center gap-2"
            onClick={() => setUploading(true)}
          >
            <UploadSimpleIcon size={20} aria-hidden />
            {uploadLabel(declared.words)}
          </Button>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <div className="mt-3">
          <EmptyRow text={list ? noneYet(declared.words) : EMAIL_UNAVAILABLE} />
        </div>
      ) : (
        <div data-testid="flow-items" className="mt-1 flex flex-col">
          {groups.map((group, at) => (
            <div key={group.title ?? `none-${at}`} className="mt-3">
              {group.title ? (
                <h3
                  data-testid="flow-item-group"
                  className="px-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
                >
                  {group.title}
                </h3>
              ) : null}
              <ul className="mt-1 flex flex-col divide-y divide-[var(--ring)]">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      prefetch={false}
                      href={itemPath(subscriptionId, item.id)}
                      data-testid={`flow-item-${item.id}`}
                      className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] px-2 py-3 transition hover:bg-[var(--surface-hover)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">
                        {item.title}
                      </span>
                      <span
                        className={`shrink-0 text-sm ${item.status === "failed" ? "text-[var(--warning-text)]" : "text-[var(--muted)]"}`}
                      >
                        {itemLine(item, declared.runWords)}
                      </span>
                      <CaretRightIcon
                        aria-hidden
                        size={16}
                        className="shrink-0 text-[var(--muted)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
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
    </section>
  );
}
