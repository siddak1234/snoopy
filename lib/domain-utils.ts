import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Public domain blocklist
// ---------------------------------------------------------------------------
// Consumer email providers whose domains must not be used to claim a workspace.
// Matching is case-insensitive (callers normalise to lowercase first).
// ---------------------------------------------------------------------------

export const PUBLIC_DOMAIN_BLOCKLIST: ReadonlyArray<string> = [
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "live.com",
  "msn.com",
  "me.com",
  "googlemail.com",
  "ymail.com",
  "yahoo.co.uk",
  "outlook.co.uk",
  "mail.com",
  "zoho.com",
  "gmx.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
];

// ---------------------------------------------------------------------------
// extractDomain
// ---------------------------------------------------------------------------
// Returns the lowercased domain portion of an email address.
// Returns "" for any input that is not a valid email shape.
// ---------------------------------------------------------------------------

export function extractDomain(email: string): string {
  if (typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex < 1) return ""; // no "@", or "@" at position 0
  const domain = trimmed.slice(atIndex + 1);
  // Minimal sanity check: must have at least one dot with chars on both sides
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "";
  }
  return domain;
}

// ---------------------------------------------------------------------------
// isPublicDomain
// ---------------------------------------------------------------------------
// Returns true if domain is on the consumer-provider blocklist.
// Input is expected to already be lowercased (extractDomain guarantees this).
// ---------------------------------------------------------------------------

export function isPublicDomain(domain: string): boolean {
  if (!domain) return false;
  return (PUBLIC_DOMAIN_BLOCKLIST as string[]).includes(domain.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// classifyEmailDomain
// ---------------------------------------------------------------------------

export type DomainClassification =
  | "public"            // consumer provider — cannot claim
  | "custom_unclaimed"  // custom domain, no organization workspace registered for it
  | "custom_claimed";   // an organization workspace already exists for this domain

export type DomainClassificationResult = {
  domain: string;
  isPublic: boolean;
  classification: DomainClassification;
  existingWorkspace: { id: string; name: string } | null;
};

/**
 * Classifies the domain of an email address for workspace routing.
 *
 *  - public domain      → "public"
 *  - org exists for it  → "custom_claimed"
 *  - no org for it      → "custom_unclaimed"
 *
 * Trust model: the joining user's email is verified by Supabase OAuth, which
 * already proves they read mail at that domain. We no longer maintain a
 * separate "domain verified" state on the workspace.
 */
export async function classifyEmailDomain(
  email: string
): Promise<DomainClassificationResult> {
  const domain = extractDomain(email);

  if (!domain) {
    return {
      domain: "",
      isPublic: false,
      classification: "custom_unclaimed",
      existingWorkspace: null,
    };
  }

  if (isPublicDomain(domain)) {
    return {
      domain,
      isPublic: true,
      classification: "public",
      existingWorkspace: null,
    };
  }

  const existing = await prisma.workspace.findFirst({
    where: { domain, type: "organization" },
    select: { id: true, name: true },
  });

  if (existing) {
    return {
      domain,
      isPublic: false,
      classification: "custom_claimed",
      existingWorkspace: existing,
    };
  }

  return {
    domain,
    isPublic: false,
    classification: "custom_unclaimed",
    existingWorkspace: null,
  };
}
