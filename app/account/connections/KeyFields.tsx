"use client";

import { FormInput } from "@/components/ui/FormInput";
import type { OfferedProvider } from "@/lib/connections";
import { vendorField } from "@/lib/smart-backend";
import { SPACING } from "@/lib/spacing";

/**
 * The key form's fields (`ConnectionsPanel`'s Connect): a pasted-key
 * provider's `credentialFields`, each required; and for the EHR, a SMART
 * Backend Services provider (backend ADR-0050, D1), its vendor first — the
 * vendors as one choice of radios when the platform lists two or more, the
 * one it lists sent unseen otherwise (`vendorField`) — then its fields, the
 * clinic's FHIR address. Each value is posted as `credential:<name>`, the
 * vendor as `credential:vendor`, which the platform takes beside the address.
 */
export function KeyFields({ provider }: { provider: OfferedProvider }) {
  const vendor = vendorField(provider);
  return (
    <>
      {vendor?.kind === "fixed" ? (
        <input type="hidden" name="credential:vendor" value={vendor.id} />
      ) : null}
      {vendor?.kind === "picker" ? (
        <div
          role="radiogroup"
          aria-label={provider.displayName}
          data-testid="vendor-picker"
          className={`flex flex-col ${SPACING.inner.gap}`}
        >
          {vendor.vendors.map((choice) => (
            <label
              key={choice.id}
              className={`flex items-center ${SPACING.inner.gap} text-sm text-[var(--text)]`}
            >
              <input
                type="radio"
                name="credential:vendor"
                value={choice.id}
                required
                className="size-4 accent-[var(--color-accent)]"
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      ) : null}
      {provider.credentialFields?.map((field) => (
        <FormInput
          key={field.name}
          id={`credential-${field.name}`}
          name={`credential:${field.name}`}
          type={field.secret ? "password" : "text"}
          label={field.label}
          hint={field.help}
          required
          autoComplete="off"
        />
      ))}
    </>
  );
}
