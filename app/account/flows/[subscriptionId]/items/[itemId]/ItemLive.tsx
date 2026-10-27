"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BlockList } from "@/components/blocks/BlockList";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type {
  AutomationItems,
  AutomationRunInputField,
  ReadItemResponse,
} from "@/lib/automations";
import {
  archiveLabel,
  canAddRun,
  inSentence,
  itemGoing,
  itemSubheader,
} from "@/lib/flow-items";
import { flowPath } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";
import { BLOCKS_SHAPE, RUN_REREAD_MS } from "@/lib/run-progress";
import { archiveItem } from "../../../actions";
import { RunStart } from "../../../RunStart";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";

/**
 * An item's page, live (Round 19, plan §5.3; backend ADR-0046). Its header:
 * its title, its group's value and where it is ("{group} · Ready",
 * "Reading…", or why it could not be read). Its body, as the platform sent
 * it (backend ADR-0048; `BlockList`), in its flow's `pages.item` order — its
 * tiles, its file's row opening the item's file page, the form that starts
 * one of its runs, and its runs, ranked as the platform answers them, each a
 * compact row opening its run's page. The run form is `RunStart`, drawn only
 * where a run can start (`canAddRun`: an owner or admin, the item ready and
 * not archived, the flow live, answering, with a run file); the run names
 * this item and joins the list as "Reading…". Its footer: Archive, for an
 * owner or admin, behind its confirmation. An answer with no blocks draws the
 * header, the footer and the fallback sentence. ~~Its tiles and ranked rows
 * drawn here~~ until Round 21.
 *
 * Read again every 2 s while it, or one of its runs, is still going
 * (`going`, else `itemGoing`; `RUN_REREAD_MS`), one read at a time, through
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
  const going = detail.going ?? itemGoing(item, runs);

  useEffect(() => {
    if (!going) return;
    let alive = true;
    const timer = setTimeout(() => {
      platformApiJson<ReadItemResponse>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(item.id)}${BLOCKS_SHAPE}`,
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
  const canAdd = canAddRun({
    canManage,
    item,
    live,
    available,
    runInputs: runInput.length,
  });

  return (
    <SectionCard
      title={item.title}
      subheader={itemSubheader(item, declared.groupField)}
      back={<BackLink href={flowPath(subscriptionId)} />}
    >
      <Group>
        <BlockList
          blocks={detail.blocks}
          testId="item-blocks"
          context={{
            subscriptionId,
            forms: {
              run: (form) =>
                canAdd ? (
                  <div data-testid="item-add">
                    <RunStart
                      workspaceId={workspaceId}
                      subscriptionId={subscriptionId}
                      runInput={runInput}
                      live={live}
                      available={available}
                      canGoLive={canGoLive}
                      initialKey={initialKey}
                      itemId={form.itemId ?? item.id}
                      onStarted={() => router.refresh()}
                    />
                  </div>
                ) : null,
            },
          }}
        />
      </Group>

      {canManage && !archived ? (
        <Group>
          <ArchiveItem
            workspaceId={workspaceId}
            subscriptionId={subscriptionId}
            itemId={item.id}
            title={item.title}
            label={archiveLabel(declared.words)}
            runsWord={declared.runWords.plural}
          />
        </Group>
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
  runsWord,
}: {
  workspaceId: string;
  subscriptionId: string;
  itemId: string;
  title: string;
  label: string;
  /** The flow's word for its runs, many: "candidates". */
  runsWord: string;
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
          <p
            id={descriptionId}
            className={`${SPACING.title.top} text-sm text-[var(--muted)]`}
          >
            It leaves the list and takes no new {inSentence(runsWord)}. Its{" "}
            {inSentence(runsWord)} stay.
          </p>
          <FormError message={error} />
          <div
            className={`${SPACING.group.top} flex flex-wrap ${SPACING.inner.gap}`}
          >
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
