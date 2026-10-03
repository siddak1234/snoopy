/**
 * A workspace holds each flow once (the owner, build 12's #9): Personal is one
 * workspace and each organization another. A flow is held while a subscription
 * of it is not archived — in any team, or in the whole workspace — and this is
 * that copy, or `undefined` when there is none. An archived one holds nothing:
 * the flow can be added afresh, which is what unarchiving it is (#4).
 *
 * The platform still takes one per team (backend 18.6.2) until its own guard
 * lands, so a workspace may hold an older duplicate; nothing here hides one.
 * The list is the platform's, newest first, so the newest copy is the one named.
 *
 * Pure, and shared by the page and the Add action, so the rule is said once.
 */
export function heldCopy<T extends { templateId: string; status: string }>(
  subscriptions: readonly T[],
  templateId: string,
): T | undefined {
  return subscriptions.find(
    (entry) => entry.templateId === templateId && entry.status !== "archived",
  );
}
