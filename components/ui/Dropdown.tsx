"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { CHOOSE, chosenLabel } from "@/lib/choices";

/** One choice: what the page holds, and what it says. */
export type DropdownOption = { value: string; label: string };

/** The trigger's look: the switcher's pill (a filter), or a form field's box. */
type Look = "pill" | "field";

const TRIGGER: Record<Look, string> = {
  pill: "flex h-10 max-w-full items-center gap-1.5 rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-60",
  field:
    "mt-1.5 flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-2.5 text-left text-[var(--text)] transition hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60",
};

/**
 * The website's drop-down (the owner's build 28: "a drop down glass style
 * like the others"; plan §3, decision 7): the workspace switcher's pattern
 * (`components/dashboard/WorkspaceSwitcher.tsx`) — a trigger that says the
 * choice, and under it a panel of glass, the site's `.bubble-soft` surface
 * (the surface at 80 % over a blur), with the raised shadow and a check on
 * the chosen row — the app's `snoopy-mobile/components/dropdown.tsx` on the
 * website. A select-only combobox (WAI-ARIA): the trigger is a `combobox` named by its
 * label, the panel a `listbox` of `option`s. Opening puts focus on the chosen
 * row; the arrow keys, Home and End move it; Enter or Space chooses; Escape
 * closes it alone — never the dialog it is in — and returns focus to the
 * trigger, as a press outside closes it. Never a row of buttons, never the
 * browser's own select.
 *
 * **Several** (`multiple`; Round 21, the platform round's F1): the listbox is
 * `aria-multiselectable`, a choice ticks or unticks its row and the panel
 * stays open, and the closed trigger says the choices in the order they were
 * chosen: "Choose", "{first}, {second}", "{n} chosen" (`chosenLabel`).
 */
export function Dropdown(
  props: {
    /** The trigger's id: a `<label htmlFor>` names it too. */
    id: string;
    options: readonly DropdownOption[];
    /** The element that names it: its visible label. */
    labelledBy: string;
    /** Said while nothing is chosen. */
    placeholder?: string;
    look?: Look;
    disabled?: boolean;
    /** The trigger is `testId`, the panel `${testId}-menu`. */
    testId?: string;
  } & (
    | {
        multiple?: false;
        /** The chosen value; one no option holds shows the placeholder. */
        value: string;
        onChange: (value: string) => void;
      }
    | {
        multiple: true;
        /** The chosen values, in the order chosen; one no option holds is not shown. */
        value: readonly string[];
        onChange: (value: string[]) => void;
      }
  ),
) {
  const {
    id,
    options,
    labelledBy,
    placeholder = CHOOSE,
    look = "field",
    disabled = false,
    testId,
  } = props;
  const listId = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const chosenValues: readonly string[] = props.multiple
    ? props.value
    : [props.value];
  const chosen = chosenValues.flatMap((value) => {
    const option = options.find((each) => each.value === value);
    return option ? [option] : [];
  });
  const isChosen = (value: string) => chosenValues.includes(value);
  const shown = props.multiple
    ? chosenLabel(
        chosen.map((option) => option.label),
        placeholder,
      )
    : (chosen[0]?.label ?? placeholder);

  // A press outside closes it; Escape closes it, and only it: a capture on the
  // document, before a dialog's own Escape (`Modal`) hears it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  // Opening puts focus on the chosen row, else the first.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    (
      list?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      ) ?? list?.querySelector<HTMLElement>('[role="option"]')
    )?.focus();
  }, [open]);

  const choose = (next: string) => {
    if (props.multiple) {
      // Several: the row ticks or unticks, and the panel stays open.
      props.onChange(
        props.value.includes(next)
          ? props.value.filter((value) => value !== next)
          : [...props.value, next],
      );
      return;
    }
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== props.value) props.onChange(next);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === "ArrowDown") next = Math.min(at + 1, rows.length - 1);
    else if (event.key === "ArrowUp") next = Math.max(at - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = rows.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const row = rows[at];
      if (row?.dataset.value !== undefined) choose(row.dataset.value);
      return;
    } else return;
    event.preventDefault();
    rows[next]?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        disabled={disabled}
        data-testid={testId}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={TRIGGER[look]}
      >
        <span
          className={`truncate ${chosen.length > 0 ? "" : "text-[var(--muted)]"}`.trim()}
        >
          {shown}
        </span>
        <CaretDownIcon
          size={16}
          aria-hidden
          className={`shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`.trim()}
        />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          aria-multiselectable={props.multiple ? true : undefined}
          data-testid={testId ? `${testId}-menu` : undefined}
          onKeyDown={onListKeyDown}
          className="absolute top-full left-0 z-50 mt-2 flex max-h-[min(22rem,70vh)] min-w-full flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] p-2 shadow-[var(--shadow-md)] backdrop-blur-[8px] sm:min-w-[14rem]"
        >
          {options.map((option) => {
            const selected = isChosen(option.value);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                data-value={option.value}
                onClick={() => choose(option.value)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] ${selected ? "font-medium" : ""}`.trim()}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected ? (
                  <CheckIcon size={16} aria-hidden className="shrink-0" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
