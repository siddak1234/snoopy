"use server";

import { revalidatePath } from "next/cache";
import { acceptAgreement } from "@/lib/agreements";
import { AGREEMENT_NOT_PUBLISHED, ASK_OWNER } from "@/lib/health-agreement";
import { PlatformServerError } from "@/lib/platform-server";
import { activeWorkspaceIfShown, WORKSPACE_CHANGED } from "@/lib/tenancy";

/**
 * The health data agreement's Accept (backend ADR-0049, C3), from the dialog
 * an owner's refused Start run or item upload opens
 * (`HealthAgreementDialog.tsx`), or from Set up's Turn on with its "Contract
 * and accept" section (`SetupForm.tsx`, ADR-0049 amendment 2): the version and
 * text hash it read, the signer's name and title, and that they are
 * authorized to sign — sent once per text read, under its key. The run, the
 * item or the turn-on is then sent by the caller, with that request's own
 * key. Accepted, the workspace's Documents list has the signed copy, so the
 * organization page is drawn again. A refusal is said in place: a person who
 * is not the owner, or no version published, in the agreement's words; a text
 * that changed since it was read (409 `agreement_changed`) as the platform
 * words it, with `state: "agreement-changed"` so Set up reads it again;
 * anything else as the platform words it.
 */
export async function acceptHealthAgreement(
  formData: FormData,
): Promise<
  { ok: true } | { ok: false; error: string; state?: "agreement-changed" }
> {
  const version = Number(formData.get("version"));
  const sha256 = String(formData.get("sha256") ?? "");
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerTitle = String(formData.get("signerTitle") ?? "").trim();
  const idempotencyKey = String(formData.get("agreementKey") ?? "");
  if (
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !/^[0-9a-f]{64}$/u.test(sha256) ||
    !signerName ||
    signerName.length > 120 ||
    !signerTitle ||
    signerTitle.length > 120 ||
    formData.get("authorized") !== "true" ||
    !/^[A-Za-z0-9._~:-]{16,128}$/u.test(idempotencyKey)
  ) {
    return { ok: false, error: "Reopen the form and try again." };
  }
  try {
    const workspaceId = await activeWorkspaceIfShown(
      String(formData.get("workspaceId") ?? ""),
    );
    if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };
    await acceptAgreement(
      workspaceId,
      {
        kind: "health-data",
        version,
        sha256,
        signerName,
        signerTitle,
        authorized: true,
      },
      idempotencyKey,
    );
    revalidatePath("/account/organization", "layout");
    return { ok: true };
  } catch (error) {
    if (!(error instanceof PlatformServerError)) throw error;
    if (
      error.status === 503 &&
      error.details?.reason === "agreement_not_published"
    )
      return { ok: false, error: AGREEMENT_NOT_PUBLISHED };
    if (error.status === 403) return { ok: false, error: ASK_OWNER };
    if (error.status === 409 && error.details?.reason === "agreement_changed")
      return { ok: false, error: error.message, state: "agreement-changed" };
    return { ok: false, error: error.message };
  }
}
