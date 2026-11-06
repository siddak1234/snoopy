"use client";

import { useState } from "react";
import { CopyIcon } from "@phosphor-icons/react/dist/ssr/Copy";
import { Button } from "@/components/ui/Button";
import {
  COPIED,
  COPY,
  copyValue,
  type ContactValue,
} from "@/lib/contact-value";
import { SPACING } from "@/lib/spacing";

/**
 * A row's email or phone, pressable (the owner's builds 37 and 39, item 11;
 * `contactValue`): the value as a `mailto:` or `tel:` link — the browser,
 * or the phone, offers its own mail or call — and Copy beside it, which puts
 * the value on the clipboard and says "Copied". A clipboard the browser
 * refuses says nothing: the value is still there to select. The app's
 * contact sheet, on the website.
 */
export function ContactLink({ contact }: { contact: ContactValue }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    setCopied(false);
    // Refused (a permission, an origin it does not trust): nothing said.
    setCopied(await copyValue(contact, navigator.clipboard));
  };
  return (
    <div
      data-testid={`contact-${contact.kind}`}
      className={`${SPACING.inner.top} flex flex-wrap items-center ${SPACING.inner.gap}`}
    >
      <a
        href={contact.href}
        className="text-sm break-all text-[var(--link)] underline underline-offset-2"
      >
        {contact.value}
      </a>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`${COPY} ${contact.value}`}
        data-testid="contact-copy"
        className={`inline-flex items-center ${SPACING.inner.gap}`}
        onClick={() => void copy()}
      >
        <CopyIcon size={20} aria-hidden />
        {COPY}
      </Button>
      <span role="status" className="text-xs text-[var(--muted)]">
        {copied ? COPIED : ""}
      </span>
    </div>
  );
}
