"use client";

import { useState, type FormEvent } from "react";
import { FormInput } from "@/components/ui/FormInput";
import { Button } from "@/components/ui/Button";
import { PlatformApiError, platformApiJson } from "@/lib/platform-api";
import type { operations } from "@/lib/generated/platform-contracts/platform";

type Status = "idle" | "sending" | "sent" | "error";
type ContactReceipt =
  operations["submitContactRequest"]["responses"][201]["content"]["application/json"];

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-xs tracking-[0.08em] text-[var(--color-neutral-400)] uppercase">
      {children}
    </span>
  );
}

/** The design's pilot-scoping form. Submission is owned by the backend API. */
export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setStatus("sending");
    setErrorMessage(null);
    try {
      await platformApiJson<ContactReceipt>("/v1/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      form.reset();
      setStatus("sent");
    } catch (error) {
      setErrorMessage(
        error instanceof PlatformApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="m-0 text-[15px] leading-7 text-[var(--color-text)]">
        Thanks — we&apos;ve got it. We review every workflow and reply within
        two business days.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <FormInput
        id="contact-industry"
        name="industry"
        type="text"
        label={<FieldLabel>Your industry and team function</FieldLabel>}
        placeholder="Healthcare, patient intake"
      />
      <FormInput
        id="contact-workflow"
        name="workflow"
        type="text"
        required
        label={<FieldLabel>The workflow you want to automate</FieldLabel>}
        placeholder="Invoices arrive by email, keyed into the ERP"
      />
      <FormInput
        id="contact-tools"
        name="tools"
        type="text"
        label={<FieldLabel>Current tools involved</FieldLabel>}
        placeholder="CRM, ticketing, internal tools"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          id="contact-volume"
          name="volume"
          type="text"
          label={<FieldLabel>Volume / frequency</FieldLabel>}
          placeholder="400 invoices a month"
        />
        <FormInput
          id="contact-email"
          name="email"
          type="email"
          required
          label={<FieldLabel>Your email</FieldLabel>}
          placeholder="you@company.com"
        />
      </div>
      <FormInput
        id="contact-success"
        name="success"
        type="text"
        label={<FieldLabel>What success looks like in 60 days</FieldLabel>}
        placeholder="Zero manual keying"
      />

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="mt-1.5 self-start">
        <Button type="submit" variant="primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </Button>
      </div>

      {status === "error" && errorMessage ? (
        <p className="m-0 text-sm text-[var(--error-text)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
