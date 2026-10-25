"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { PageRow } from "@/components/dashboard/PageRow";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type {
  AutomationItems,
  AutomationRunInputField,
  ReadItemResponse,
} from "@/lib/automations";
import {
  addRunLabel,
  archiveLabel,
  canAddRun,
  inSentence,
  itemGoing,
  itemSubheader,
  noneYet,
  rankedRows,
} from "@/lib/flow-items";
import { flowPath } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";
import { RUN_REREAD_MS } from "@/lib/run-progress";
import { archiveItem } from "../../../actions";
import { RunStart } from "../../../RunStart";

/**
 * An item's page, live (Round 19, plan §5.3; backend ADR-0046). Top to
 * bottom: its title, its group's value and where it is ("{group} ·
 * Ready", "Reading…", or why it could not be read); for an owner or admin
 * while it is ready and not archived and a run can start (`canAddRun`: the
 * flow live, answering, with a run file), "Add {run}": the flow's run file,
 * the accepted types in words, and Start — the run names this item and
 * joins the list below as "Reading…"; its runs, ranked exactly as the
 * platform answers them (`rankedRows`), each a compact row the height of a
 * section's (`PageRow`; the owner's build 28 item 5): its rank, its title, its
 * score and the arrow, opening its run's page; and Archive for an owner or
 * admin, behind its confirmation. ~~"What AI read", its file's reading, under
 * the runs~~ until build 28 (item 4): its sections go to the item's file page
 * (plan §3).
 *
 * Read again every 2 s while it, or one of its runs, is still going
 * (`itemGoing`, `RUN_REREAD_MS`), one read at a time, through
 * `/api/platform`; a read that fails leaves the page as it was.
 */
export function ItemLive({
  workspaceId,
  subscriptionId,
  declared,
  initial,
  runInput,
  live,
  available,
  canGoLive,
  canManage,
  initialKey,
}: {
  workspaceId: string;
  subscriptionId: string;
  declared: AutomationItems;
  initial: ReadItemResponse;
  /** The run file the flow's version declares. */
  runInput: AutomationRunInputField[];
  live: boolean;
  available: boolean;
  canGoLive: boolean;
  /** An owner or admin: Add and Archive are theirs. */
  canManage: boolean;
  initialKey: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a run started): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setDetail(initial);
  }
  const [reads, setReads] = useState(0);
  const { item, runs } = detail;
  const going = itemGoing(item, runs);

  useEffect(() => {
    if (!going) return;
    let alive = true;
    const timer = setTimeout(() => {
      platformApiJson<ReadItemResponse>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(item.id)}`,
      )
        .then((answer) => {
          if (alive) setDetail(answer);
        })
        .catch(() => undefined)
        .finally(() => {
          if (alive) setReads((count) => count + 1);
        });
    }, RUN_REREAD_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [going, reads, workspaceId, item.id]);

  const archived = item.archivedAt !== null;
  const rows = rankedRows(runs);

  return (
    <SectionCard
      title={item.title}
      subheader={itemSubheader(item, declared.groupField)}
      back={<BackLink href={flowPath(subscriptionId)} />}
    >
      {canAddRun({
        canManage,
        item,
        live,
        available,
        runInputs: runInput.length,
      }) ? (
        <section aria-labelledby="item-add-title" className="py-5 first:pt-0">
          <h2
            id="item-add-title"
            className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
          >
            {addRunLabel(declared.runWords)}
          </h2>
          <div data-testid="item-add" className="mt-3">
            <RunStart
              workspaceId={workspaceId}
              subscriptionId={subscriptionId}
              runInput={runInput}
              live={live}
              available={available}
              canGoLive={canGoLive}
              initialKey={initialKey}
              itemId={item.id}
              onStarted={() => router.refresh()}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="item-runs-title" className="py-5 first:pt-0">
        <h2
          id="item-runs-title"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          {declared.runWords.plural}
        </h2>
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyRow text={noneYet(declared.runWords)} />
          </div>
        ) : (
          <ol data-testid="item-runs" className="mt-3 flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id}>
                <PageRow
                  href={`/account/runs/${encodeURIComponent(row.id)}`}
                  testId={`item-run-${row.rank}`}
                  dim={row.dim}
                  end={
                    row.score !== null ? (
                      <span className="shrink-0 text-sm font-medium text-[var(--text)] tabular-nums">
                        <span className="sr-only">Score </span>
                        {row.score}
                      </span>
                    ) : null
                  }
                >
                  <span className="w-6 shrink-0 text-[var(--muted)] tabular-nums">
                    {row.rank}
                  </span>
                  {/* Dimmed in the muted token, never by opacity: its text
                      keeps AA contrast. */}
                  <span
                    className={`min-w-0 truncate font-medium ${row.dim ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
                  >
                    {row.title}
                  </span>
                </PageRow>
              </li>
            ))}
          </ol>
        )}
      </section>

      {canManage && !archived ? (
        <div className="py-5">
          <ArchiveItem
            workspaceId={workspaceId}
            subscriptionId={subscriptionId}
            itemId={item.id}
            title={item.title}
            label={archiveLabel(declared.words)}
            runWords={declared.runWords.plural}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}

/**
 * Archive, last and in red, behind the confirmation a flow's Archive has
 * (`AutomationActions`): one-way — it leaves its flow's list and takes no
 * new run; its runs stay. Then back to the flow's page.
 */
function ArchiveItem({
  workspaceId,
  subscriptionId,
  itemId,
  title,
  label,
  runWords,
}: {
  workspaceId: string;
  subscriptionId: string;
  itemId: string;
  title: string;
  label: string;
  runWords: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setError(null);
  };
  const archive = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      data.set("itemId", itemId);
      const result = await archiveItem(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(flowPath(subscriptionId));
    });
  };
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        data-testid="item-archive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      {open ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={titleId}
          ariaDescribedBy={descriptionId}
          zIndex={100}
          dismissible={!pending}
        >
          <h2 id={titleId} className="text-xl font-semibold text-[var(--text)]">
            Archive {title}?
          </h2>
          <p id={descriptionId} className="mt-1 text-sm text-[var(--muted)]">
            It leaves the list and takes no new {inSentence(runWords)}. Its{" "}
            {inSentence(runWords)} stay.
          </p>
          <FormError message={error} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={archive}
              disabled={pending}
            >
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
