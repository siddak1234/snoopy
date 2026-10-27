"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr/UserCircle";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import {
  ConnectionRow,
  GlyphMark,
  NoneMark,
} from "@/components/dashboard/ConnectionRow";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import type { FlowEmailRecipients } from "@/lib/automations";
import {
  EMAIL_ADD,
  EMAIL_ADDING,
  EMAIL_ALSO_LABEL,
  EMAIL_ALWAYS_LABEL,
  EMAIL_ASK_ADMIN,
  EMAIL_DUPLICATE,
  EMAIL_EXTRA_LIMIT,
  EMAIL_INVALID,
  EMAIL_LIMIT_REACHED,
  EMAIL_NONE,
  EMAIL_PLACEHOLDER,
  EMAIL_REMOVING,
  EMAIL_ROLE,
  EMAIL_SAVE_FAILED,
  EMAIL_STARTER,
  addProblem,
  removeAddress,
} from "@/lib/flow-email";
import { saveEmailRecipients } from "../../actions";
import { Group } from "@/components/dashboard/Group";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { SPACING } from "@/lib/spacing";

/**
 * The email page's two lists and its one field (Build 22, P5; spec §4). **Each
 * add and each remove is saved at once** (the session's S30, fewest taps):
 * Add checks the address first — not one, "Enter an email address."; already
 * listed, without case, "Already on the list." — then sends the whole list
 * and shows the platform's answer; a remove sends the list without it, no
 * question, its row saying "Removing…" meanwhile. A refusal or a failure says
 * "Could not save. Try again." under the section, the list unchanged. One
 * write at a time; typing clears the line; the field clears after a saved add
 * (the app's M8). A member sees the lists and "Ask an owner or admin to
 * change this." — no remove, no field (the session's S12).
 *
 * **A write's end hands focus back** (the Build 22 review): the field and the
 * buttons are disabled while one waits, and a remove takes its row's button
 * with it, so focus that fell to the page goes to the address field — or, at
 * ten, where the field gives way, to Also send to's heading — as the
 * website's other removable rows hand it on (`ConfirmRemoveButton`'s
 * `focusAfter`). The field is the design system's (`FormInput`).
 */
export function EmailRecipientsForm({
  workspaceId,
  subscriptionId,
  initial,
}: {
  /** The workspace this page shows; a save is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  /** Who gets the email, as the page was drawn. */
  initial: FlowEmailRecipients;
}) {
  const [, startTransition] = useTransition();
  // The platform's latest answer to a change made here, over what was drawn.
  const [answered, setAnswered] = useState<FlowEmailRecipients | null>(null);
  const [drawn, setDrawn] = useState(initial);
  // The server drew the page again (a save revalidates it): its answer wins.
  if (drawn !== initial) {
    setDrawn(initial);
    setAnswered(null);
  }
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Counts the writes that ended; each one hands back focus the page dropped.
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (settled === 0) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (fieldRef.current ?? headingRef.current)?.focus();
  }, [settled]);

  const recipients = answered ?? initial;
  const { people, extra, canEdit } = recipients;
  const writing = adding || removing !== null;
  const full = extra.length >= EMAIL_EXTRA_LIMIT;

  /** Send the whole list; show the platform's answer, or say it was not saved and keep the list. */
  const save = (next: string[], done: (saved: boolean) => void) => {
    startTransition(async () => {
      const data = new FormData();
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      for (const address of next) data.append("extra", address);
      try {
        const result = await saveEmailRecipients(data);
        if (result.ok) setAnswered(result.recipients);
        else setError(result.error);
        done(result.ok);
      } catch {
        // The action never answered (the network, the server): said the same.
        setError(EMAIL_SAVE_FAILED);
        done(false);
      }
    });
  };

  const add = () => {
    if (writing) return;
    const problem = addProblem(draft, recipients);
    if (problem) {
      setError(problem === "invalid" ? EMAIL_INVALID : EMAIL_DUPLICATE);
      return;
    }
    setAdding(true);
    setError(null);
    save([...extra, draft.trim()], (saved) => {
      if (saved) setDraft("");
      setAdding(false);
      setSettled((count) => count + 1);
    });
  };

  const remove = (address: string) => {
    if (writing) return;
    setRemoving(address);
    setError(null);
    save(
      extra.filter((listed) => listed !== address),
      () => {
        setRemoving(null);
        setSettled((count) => count + 1);
      },
    );
  };

  return (
    <Group>
      <section aria-labelledby="email-always-title" data-testid="email-always">
        <SectionTitle id="email-always-title">
          {EMAIL_ALWAYS_LABEL}
        </SectionTitle>
        <ul
          className={`${SPACING.title.top} flex flex-col divide-y divide-[var(--ring)]`}
        >
          {people.map((person) => (
            <li key={person.email}>
              <ConnectionRow
                testId={`email-person-${person.email}`}
                mark={<GlyphMark icon={UserCircleIcon} />}
                name={person.email}
                line={EMAIL_ROLE[person.role]}
              />
            </li>
          ))}
          <li>
            <ConnectionRow
              testId="email-starter"
              mark={<GlyphMark icon={UserCircleIcon} />}
              name={EMAIL_STARTER}
            />
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="email-also-title"
        data-testid="email-also"
        className={SPACING.group.pt}
      >
        <SectionTitle id="email-also-title" ref={headingRef} tabIndex={-1}>
          {EMAIL_ALSO_LABEL}
        </SectionTitle>
        <ul
          className={`${SPACING.title.top} flex flex-col divide-y divide-[var(--ring)]`}
        >
          {extra.length === 0 ? (
            <li>
              <ConnectionRow
                testId="email-extra-none"
                mark={<NoneMark />}
                name={EMAIL_NONE}
              />
            </li>
          ) : null}
          {extra.map((address) => (
            <li key={address}>
              <ConnectionRow
                testId={`email-extra-${address}`}
                mark={<GlyphMark icon={EnvelopeSimpleIcon} />}
                name={address}
                line={removing === address ? EMAIL_REMOVING : null}
                right={
                  canEdit ? (
                    <button
                      type="button"
                      aria-label={removeAddress(address)}
                      disabled={writing}
                      onClick={() => remove(address)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
                    >
                      <XIcon aria-hidden size={20} />
                    </button>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
        {canEdit ? (
          full ? (
            <p
              data-testid="email-limit"
              className={`${SPACING.inner.top} text-sm text-[var(--muted)]`}
            >
              {EMAIL_LIMIT_REACHED}
            </p>
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
              className={`${SPACING.inner.top} flex items-end ${SPACING.inner.gap}`}
            >
              <div className="min-w-0 flex-1">
                <FormInput
                  ref={fieldRef}
                  type="email"
                  name="address"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  aria-label={EMAIL_PLACEHOLDER}
                  placeholder={EMAIL_PLACEHOLDER}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={adding}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={writing}
                className={`inline-flex shrink-0 items-center ${SPACING.inner.gap}`}
              >
                <PlusIcon aria-hidden size={20} />
                {adding ? EMAIL_ADDING : EMAIL_ADD}
              </Button>
            </form>
          )
        ) : (
          <p
            data-testid="email-ask-admin"
            className={`${SPACING.inner.top} text-sm text-[var(--muted)]`}
          >
            {EMAIL_ASK_ADMIN}
          </p>
        )}
        <FormError message={error} className={SPACING.inner.top} />
      </section>
    </Group>
  );
}
