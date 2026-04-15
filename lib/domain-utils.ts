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
  | "public"                    // consumer provider — cannot claim
  | "custom_unclaimed"          // custom domain, no workspace has registered it
  | "custom_claimed_verified"   // another workspace owns + has verified this domain
  | "custom_claimed_unverified" // another workspace registered but not yet verified

export type DomainClassificationResult = {
  domain: string;
  isPublic: boolean;
  classification: DomainClassification;
  existingWorkspace: { id: string; name: string } | null;
};

/**
 * Classifies the domain of an email address for workspace auto-join eligibility.
 *
 * Flow:
 *  1. Extract and validate domain from email.
 *  2. If on public blocklist → "public", no DB lookup.
 *  3. Query workspaces for domain match with domainVerified = true  → "custom_claimed_verified"
 *  4. Query workspaces for domain match with domainVerified = false → "custom_claimed_unverified"
 *  5. No match → "custom_unclaimed"
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

  // Check for a verified claim first (higher precedence)
  const verifiedWorkspace = await prisma.workspace.findFirst({
    where: { domain, domainVerified: true },
    select: { id: true, name: true },
  });

  if (verifiedWorkspace) {
    return {
      domain,
      isPublic: false,
      classification: "custom_claimed_verified",
      existingWorkspace: verifiedWorkspace,
    };
  }

  // Check for an unverified claim
  const unverifiedWorkspace = await prisma.workspace.findFirst({
    where: { domain, domainVerified: false },
    select: { id: true, name: true },
  });

  if (unverifiedWorkspace) {
    return {
      domain,
      isPublic: false,
      classification: "custom_claimed_unverified",
      existingWorkspace: unverifiedWorkspace,
    };
  }

  return {
    domain,
    isPublic: false,
    classification: "custom_unclaimed",
    existingWorkspace: null,
  };
}

// ---------------------------------------------------------------------------
// checkDuplicateDomain
// ---------------------------------------------------------------------------
// Returns true if any workspace OTHER than excludeWorkspaceId has this domain
// verified. Used before allowing a workspace to claim or re-verify a domain.
// ---------------------------------------------------------------------------

export async function checkDuplicateDomain(
  domain: string,
  excludeWorkspaceId?: string
): Promise<boolean> {
  if (!domain) return false;
  const normalised = domain.trim().toLowerCase();

  const existing = await prisma.workspace.findFirst({
    where: {
      domain: normalised,
      domainVerified: true,
      ...(excludeWorkspaceId ? { id: { not: excludeWorkspaceId } } : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}
