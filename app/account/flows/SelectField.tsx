"use client";

import { useState, type ReactNode } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { CHOOSE_AT_LEAST_ONE } from "@/lib/choices";
import { SPACING } from "@/lib/spacing";

/**
 * A setup `select` (Round 21, the platform round's F1): the website's
 * drop-down (`Dropdown`, never the browser's own select) of the field's
 * `options`, one chosen or, `multiple`, several. Its form value is one
 * hidden `<prefix>:<key>` per choice, in the order chosen, and its control
 * `select`, or `select-multiple` for several, so the action sends a list
 * (`declaredValues`). A required one left empty says "Choose at least one."
 * under it once the save found it (`missingChoice`).
 */
export function SelectField({
  fieldKey,
  title,
  options,
  multiple,
  initial,
  prefix,
  missing,
  optional,
}: {
  fieldKey: string;
  title: string;
  options: readonly string[];
  multiple: boolean;
  /** What the flow holds now, else the field's default: only its known options are kept. */
  initial: unknown;
  prefix: "config" | "input";
  /** The save found it required and empty. */
  missing: boolean;
  /** "Optional" beside the title. */
  optional: ReactNode;
}) {
  const known = (value: unknown): value is string =>
    typeof value === "string" && options.includes(value);
  const start = (
    Array.isArray(initial) ? initial : initial === undefined ? [] : [initial]
  ).filter(known);
  const [chosen, setChosen] = useState<string[]>(
    multiple ? [...new Set(start)] : start.slice(0, 1),
  );
  const id = `${prefix}-${fieldKey}`;
  const labelId = `${id}-label`;
  const choices = options.map((option) => ({ value: option, label: option }));
  return (
    <div>
      <input
        type="hidden"
        name={`${prefix}-control:${fieldKey}`}
        value={multiple ? "select-multiple" : "select"}
      />
      {chosen.map((value) => (
        <input
          key={value}
          type="hidden"
          name={`${prefix}:${fieldKey}`}
          value={value}
        />
      ))}
      <label
        id={labelId}
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {title}
        {optional}
      </label>
      {multiple ? (
        <Dropdown
          id={id}
          labelledBy={labelId}
          options={choices}
          multiple
          value={chosen}
          onChange={setChosen}
          testId={`select-${fieldKey}`}
        />
      ) : (
        <Dropdown
          id={id}
          labelledBy={labelId}
          options={choices}
          value={chosen[0] ?? ""}
          onChange={(value) => setChosen([value])}
          testId={`select-${fieldKey}`}
        />
      )}
      {missing && chosen.length === 0 ? (
        <p
          role="alert"
          data-testid={`select-missing-${fieldKey}`}
          className={`${SPACING.inner.top} text-sm text-[var(--error-text)]`}
        >
          {CHOOSE_AT_LEAST_ONE}
        </p>
      ) : null}
    </div>
  );
}
