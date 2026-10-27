"use client";

import { useId } from "react";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { Button } from "@/components/ui/Button";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { fill } from "@/lib/block-sort";
import {
  BLOCK_SEARCH,
  BLOCK_WORDS,
} from "@/lib/generated/platform-contracts/block-rules";
import { SPACING } from "@/lib/spacing";

/**
 * The search, sort and pages bar (backend ADR-0048 amendment 1, decision 4;
 * the app's `ListTools`): a search box, the sort drop-down and the pager,
 * each in the platform's words (`BLOCK_WORDS`), spaced by the table
 * (`lib/spacing.ts`). A list or table inside the blocks (`Paged`), a flow's
 * items (`FlowItems`) and Activity (`ActivityControls`) draw these, so each
 * says and looks the same.
 */

/** The search box: its hint, and × to empty it once there is something to empty. */
export function SearchBox({
  hint,
  value,
  onChange,
  name,
  testId = "list-search",
}: {
  /** The hint text: "Search", "Search jobs", "Search runs". */
  hint: string;
  value: string;
  onChange: (value: string) => void;
  /** A form's field name, where the box is in one (Activity's `q`). */
  name?: string;
  testId?: string;
}) {
  return (
    <div
      className={`flex h-11 w-full items-center rounded-full border border-[var(--ring)] bg-[var(--card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-strong)] ${SPACING.rowX.x} ${SPACING.inner.gap}`}
    >
      <MagnifyingGlassIcon
        size={16}
        aria-hidden
        className="shrink-0 text-[var(--muted)]"
      />
      <input
        type="search"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
        aria-label={hint}
        maxLength={BLOCK_SEARCH.queryLength}
        data-testid={testId}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={BLOCK_WORDS.clearSearch}
          onClick={() => onChange("")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
        >
          <XIcon size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** The sort drop-down, named "Sort" for a screen reader. */
export function SortChoice({
  choices,
  value,
  onChange,
  testId = "list-sort",
}: {
  choices: readonly DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex">
      <span id={`${id}-label`} className="sr-only">
        {BLOCK_WORDS.sort}
      </span>
      <Dropdown
        id={id}
        look="pill"
        labelledBy={`${id}-label`}
        options={choices}
        value={value}
        onChange={onChange}
        testId={testId}
      />
    </div>
  );
}

/** The pager: Previous, "Page {n} of {total}", Next. */
export function Pager({
  page,
  pages,
  onPage,
  testId = "list-pager",
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex items-center justify-between ${SPACING.inner.gap}`}
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        aria-label={BLOCK_WORDS.previousPage}
        onClick={() => onPage(page - 1)}
        className={`inline-flex items-center ${SPACING.inner.gap}`}
      >
        <CaretLeftIcon size={16} aria-hidden />
        {BLOCK_WORDS.previous}
      </Button>
      <p aria-live="polite" className="text-sm text-[var(--muted)]">
        {fill(BLOCK_WORDS.pageOf, { n: page, total: pages })}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        aria-label={BLOCK_WORDS.nextPage}
        onClick={() => onPage(page + 1)}
        className={`inline-flex items-center ${SPACING.inner.gap}`}
      >
        {BLOCK_WORDS.next}
        <CaretRightIcon size={16} aria-hidden />
      </Button>
    </div>
  );
}
