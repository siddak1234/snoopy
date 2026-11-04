"use client";

import { useEffect, useId, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { PageRow } from "@/components/dashboard/PageRow";
import { LIST_CARD, SECTION_BAR } from "@/components/dashboard/SectionRows";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { Dropdown } from "@/components/ui/Dropdown";
import type { ListItemsResponse } from "@/lib/automations";
import { noneYet } from "@/lib/flow-items";
import { flowPath } from "@/lib/flow-steps";
import { platformApiJson } from "@/lib/platform-api";
import { CARD, SPACING } from "@/lib/spacing";
import type { Department } from "./flows/departments";
import { RunStart } from "./flows/RunStart";
import { jobChoices, type HomeFlow } from "./home-flows";

/**
 * Home's YOUR FLOWS, drawn (the owner's build 34 F5; `homeFlows`): each
 * department's title, then its flows as one card of divided rows. A flow
 * whose run can start here opens in place on a press to its run's first
 * step — its run input's fields and Start run (`RunStart`: the upload and
 * the run's start as the flow's page sends them), which opens the run's
 * page. A flow with items reads them when it is first opened, never before,
 * and asks for one (its word, "Job") in the drop-down first; the form then
 * starts a run of that item. Any other flow's row opens its page.
 */
export function YourFlows({
  workspaceId,
  departments,
}: {
  workspaceId: string;
  departments: Department<HomeFlow>[];
}) {
  return (
    <div className="flex flex-col">
      {departments.map(({ department, id, entries }, at) => (
        <div key={id} className={at > 0 ? SPACING.group.top : undefined}>
          <SectionTitle as="h3" id={`home-${id}`}>
            {department}
          </SectionTitle>
          <ul
            aria-labelledby={`home-${id}`}
            className={`${SPACING.title.top} ${LIST_CARD}`}
          >
            {entries.map((flow) => (
              <li key={flow.id}>
                <FlowRow workspaceId={workspaceId} flow={flow} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FlowRow({
  workspaceId,
  flow,
}: {
  workspaceId: string;
  flow: HomeFlow;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const name = (
    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">
      {flow.name}
    </span>
  );
  if (!flow.startable)
    return (
      <PageRow href={flowPath(flow.id)} boxed={false}>
        {name}
      </PageRow>
    );
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        className={`${SECTION_BAR} w-full text-left transition hover:bg-[var(--surface-hover)]`}
      >
        {name}
        <CaretDownIcon
          size={20}
          aria-hidden
          className={`shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`.trim()}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          data-testid={`home-flow-${flow.id}`}
          className={`border-t border-[var(--ring)] ${CARD}`}
        >
          {flow.items ? (
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
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A flow with items, opened: its items read once, now; the ready ones in a
 * drop-down under their group (`jobChoices`); one chosen, the run form for
 * it under a key of its own. A read that fails says "Unavailable"; none
 * ready says the flow's own "No jobs yet.".
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
  const [items, setItems] = useState<ListItemsResponse["items"] | "failed">();
  const [itemId, setItemId] = useState("");
  const [runKey, setRunKey] = useState(flow.initialKey);

  useEffect(() => {
    let live = true;
    platformApiJson<ListItemsResponse>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/subscriptions/${encodeURIComponent(flow.id)}/items`,
    )
      .then((answer) => {
        if (live) setItems(answer.items);
      })
      .catch(() => {
        if (live) setItems("failed");
      });
    return () => {
      live = false;
    };
  }, [workspaceId, flow.id]);

  if (items === undefined)
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  if (items === "failed")
    return <p className="text-sm text-[var(--muted)]">Unavailable</p>;
  const choices = jobChoices(items, declared.groupField);
  if (choices.length === 0)
    return (
      <p className="text-sm text-[var(--muted)]">{noneYet(declared.words)}</p>
    );
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
          value={itemId}
          onChange={(value) => {
            setItemId(value);
            setRunKey(`run-${crypto.randomUUID()}`);
          }}
          testId={`home-job-${flow.id}`}
        />
      </div>
      {itemId ? (
        <RunStart
          key={itemId}
          workspaceId={workspaceId}
          subscriptionId={flow.id}
          runInput={flow.runInput}
          live
          available
          canGoLive
          initialKey={runKey}
          itemId={itemId}
        />
      ) : null}
    </div>
  );
}
