"use client";

import { useState, type ReactNode } from "react";
import { ChoiceSheet } from "@/components/ui/ChoiceSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { CHOOSE_AT_LEAST_ONE, carriesGroups, type Choice } from "@/lib/choices";
import { SPACING } from "@/lib/spacing";

/**
 * A setup `select` (Round 21, the platform round's F1): the website's
 * drop-down (`Dropdown`, never the browser's own select) of the field's
 * `options`, one chosen or, `multiple`, several. Its form value is one
 * hidden `<prefix>:<key>` per choice, in the order chosen, and its control
 * `select`, or `select-multiple` for several, so the action sends a list
 * (`declaredValues`). A required one left empty says "Choose at least one."
 * under it once the save found it (`missingChoices`).
 *
 * Its choices are the manifest's `options` read by `choicesOf` (platform
 * round 2's B1): strings, or `{value, label, group}` — the form posts the
 * `value`, the drop-down says the `label` under its `group`'s heading.
 *
 * Choices that carry groups are the sheet instead (`ChoiceSheet`; the
 * owner's build 34 F1): Category, then one group's choices, each searched,
 * and "Search all" over every choice; each pick a chip under the box.
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
  options: readonly Choice[];
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
    typeof value === "string" &&
    options.some((option) => option.value === value);
  const start = (
    Array.isArray(initial) ? initial : initial === undefined ? [] : [initial]
  ).filter(known);
  const [chosen, setChosen] = useState<string[]>(
    multiple ? [...new Set(start)] : start.slice(0, 1),
  );
  const id = `${prefix}-${fieldKey}`;
  const labelId = `${id}-label`;
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
      {carriesGroups(options) ? (
        multiple ? (
          <ChoiceSheet
            id={id}
            labelledBy={labelId}
            title={title}
            options={options}
            multiple
            value={chosen}
            onChange={setChosen}
            testId={`select-${fieldKey}`}
          />
        ) : (
          <ChoiceSheet
            id={id}
            labelledBy={labelId}
            title={title}
            options={options}
            value={chosen[0] ?? ""}
            onChange={(value) => setChosen([value])}
            testId={`select-${fieldKey}`}
          />
        )
      ) : multiple ? (
        <Dropdown
          id={id}
          labelledBy={labelId}
          options={options}
          multiple
          value={chosen}
          onChange={setChosen}
          testId={`select-${fieldKey}`}
        />
      ) : (
        <Dropdown
          id={id}
          labelledBy={labelId}
          options={options}
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
