"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CHIP, chipTone } from "@/components/blocks/look";
import { LIST_CARD } from "@/components/dashboard/SectionRows";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import Modal from "@/components/ui/Modal";
import {
  CATEGORY,
  CHOOSE,
  NO_MATCHES,
  SEARCH,
  SEARCH_ALL,
  choiceGroups,
  choicesIn,
  chosenLabel,
  groupsOf,
  type Choice,
} from "@/lib/choices";
import { ROW, SPACING } from "@/lib/spacing";
import { TRIGGER } from "./Dropdown";

/** A search box in the sheet: the form fields' box. */
const SEARCH_BOX = `w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] ${SPACING.rowX.x} ${SPACING.inner.py} text-sm text-[var(--text)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none`;

/** A row of the sheet: a group, or a choice. */
const SHEET_ROW = `flex w-full cursor-pointer items-center justify-between ${SPACING.inner.gap} ${ROW} text-left text-sm text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none`;

/**
 * A setup `select` whose choices carry groups (the owner's build 34 F1: "The
 * drop down is quite small … rather than one drop down is it possible to do
 * two? One for category and then the sub specialty … add a typing feature"):
 * the field's box, saying what is chosen as the drop-down's does
 * (`chosenLabel`), each pick under it as a chip; pressed, a sheet the
 * page's height (`Modal`, a dialog named by the field's title). Step 1 lists
 * the groups under "Category", with a "Search all" box that searches every
 * choice, its finds under their headings; a group opens step 2: its choices,
 * with a "Search" box over them alone. Back goes from step 2 to step 1, and
 * from step 1 to the form, as Escape and a press outside do. One choice
 * closes the sheet; several (`multiple`) tick and untick, and it stays.
 * Nothing new is read: the choices are the setup's own (`choicesOf`).
 */
export function ChoiceSheet(
  props: {
    id: string;
    /** The field's visible label, which names the box and the sheet. */
    labelledBy: string;
    title: string;
    options: readonly Choice[];
    /** The box is `testId`, the sheet `${testId}-sheet`. */
    testId?: string;
  } & (
    | {
        multiple?: false;
        value: string;
        onChange: (value: string) => void;
      }
    | {
        multiple: true;
        value: readonly string[];
        onChange: (value: string[]) => void;
      }
  ),
) {
  const { id, labelledBy, title, options, testId } = props;
  const [open, setOpen] = useState(false);
  const chosenValues: readonly string[] = props.multiple
    ? props.value
    : props.value
      ? [props.value]
      : [];
  const chosen = chosenValues.flatMap((value) => {
    const option = options.find((each) => each.value === value);
    return option ? [option] : [];
  });

  const choose = (next: string) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(next)
          ? props.value.filter((value) => value !== next)
          : [...props.value, next],
      );
      return;
    }
    setOpen(false);
    if (next !== props.value) props.onChange(next);
  };

  return (
    <div>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        data-testid={testId}
        onClick={() => setOpen(true)}
        className={TRIGGER.field}
      >
        <span
          className={`truncate ${chosen.length > 0 ? "" : "text-[var(--muted)]"}`.trim()}
        >
          {chosenLabel(
            chosen.map((option) => option.label),
            CHOOSE,
          )}
        </span>
        <CaretDownIcon
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--muted)]"
        />
      </button>
      {chosen.length > 0 ? (
        <ul
          aria-labelledby={labelledBy}
          data-testid={testId ? `${testId}-chips` : undefined}
          className={`${SPACING.inner.top} flex flex-wrap ${SPACING.inner.gap}`}
        >
          {chosen.map((option) => (
            <li key={option.value} className={`${CHIP} ${chipTone("neutral")}`}>
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabelledBy={labelledBy}
          contentClassName={`flex h-[calc(100dvh-2rem)] flex-col ${SPACING.group.gap}`}
        >
          <SheetSteps
            title={title}
            options={options}
            chosen={chosenValues}
            multiple={props.multiple === true}
            onChoose={choose}
            onClose={() => setOpen(false)}
            testId={testId ? `${testId}-sheet` : undefined}
          />
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * The sheet's two steps (`ChoiceSheet`): the groups, or one group's
 * choices; a search in either draws the choices it finds.
 */
export function SheetSteps({
  title,
  options,
  chosen,
  multiple,
  onChoose,
  onClose,
  testId,
}: {
  title: string;
  options: readonly Choice[];
  chosen: readonly string[];
  multiple: boolean;
  onChoose: (value: string) => void;
  onClose: () => void;
  testId?: string;
}) {
  const headingId = useId();
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const back = () => {
    setQuery("");
    if (group === null) onClose();
    else setGroup(null);
  };
  // Step 2 is one group's choices; step 1 searched, every choice found.
  const found =
    group !== null
      ? [{ group: null, choices: choicesIn(options, group, query) }].filter(
          ({ choices }) => choices.length > 0,
        )
      : query.trim()
        ? choiceGroups(options, query)
        : null;

  const row = (option: Choice) => {
    const selected = chosen.includes(option.value);
    const press = () => onChoose(option.value);
    return (
      <div
        key={option.value}
        role="option"
        aria-selected={selected}
        tabIndex={0}
        data-value={option.value}
        onClick={press}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          press();
        }}
        className={`${SHEET_ROW} ${selected ? "font-medium" : ""}`.trim()}
      >
        <span className="min-w-0 break-words">{option.label}</span>
        {selected ? (
          <CheckIcon size={16} aria-hidden className="shrink-0" />
        ) : null}
      </div>
    );
  };

  return (
    <div
      data-testid={testId}
      className={`flex min-h-0 flex-1 flex-col ${SPACING.group.gap}`}
    >
      <div className={`flex items-center ${SPACING.inner.gap}`}>
        <button
          type="button"
          aria-label="Back"
          onClick={back}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ring)] text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeftIcon aria-hidden size={24} />
        </button>
        <h2
          id={headingId}
          className="min-w-0 truncate text-lg font-semibold text-[var(--text)]"
        >
          {group ?? title}
        </h2>
      </div>
      <input
        key={group ?? ""}
        type="search"
        value={query}
        placeholder={group === null ? SEARCH_ALL : SEARCH}
        aria-label={group === null ? SEARCH_ALL : SEARCH}
        autoComplete="off"
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        className={SEARCH_BOX}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {found === null ? (
          <>
            <SectionTitle as="h3">{CATEGORY}</SectionTitle>
            <ul className={`${SPACING.title.top} ${LIST_CARD}`}>
              {groupsOf(options).map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setGroup(name);
                    }}
                    className={SHEET_ROW}
                  >
                    <span className="min-w-0 break-words">{name}</span>
                    <CaretRightIcon
                      size={20}
                      aria-hidden
                      className="shrink-0 text-[var(--muted)]"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : found.length === 0 ? (
          <p role="status" className="text-sm text-[var(--muted)]">
            {NO_MATCHES}
          </p>
        ) : (
          <div
            role="listbox"
            aria-labelledby={headingId}
            aria-multiselectable={multiple ? true : undefined}
            className={LIST_CARD}
          >
            {found.map(({ group: heading, choices }, at) =>
              heading === null ? (
                choices.map(row)
              ) : (
                <div
                  key={`group-${at}`}
                  role="group"
                  aria-labelledby={`${headingId}-group-${at}`}
                  className="flex flex-col"
                >
                  <div
                    id={`${headingId}-group-${at}`}
                    role="presentation"
                    className={`${ROW} text-xs font-medium text-[var(--muted)]`}
                  >
                    {heading}
                  </div>
                  {choices.map(row)}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
