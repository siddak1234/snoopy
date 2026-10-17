import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import {
  FLOWS,
  connectionRow,
  fixtureControl,
  holdRequest,
  isServerAction,
  presentSession,
} from "./helpers";

/**
 * Every dialog `components/ui/Modal.tsx` serves — thirteen, one row each — held
 * to the same behaviours (filed at Round 15's close; the register's § "The
 * backlog before Round 17"):
 *
 * - Escape closes it while it sends nothing, and focus goes back to the
 *   control that opened it;
 * - a click outside it closes it too;
 * - one that sends a request holds while the request is in flight — against
 *   Escape, a click outside and its own way out — so the answer, a refusal or
 *   a secret shown once, is said where the person is looking (register F76);
 * - and it is dismissible again in the commit that brings its buttons back: an
 *   Escape pressed that instant closes it (register F72).
 *
 * A request is held in the browser (`holdRequest`): a server action's POST to
 * its own page, or the page's own call through `/api/platform`.
 */

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

// Every test starts from the fixture's first state (register F30, F48).
test.beforeEach(async () => {
  await fixtureControl("reset");
});

const busy = "The platform is busy right now. Try again in 30 seconds.";
const team = "/account/teams/33333333-3333-4333-8333-333333333333";

/** A server action, as its page sends it: a POST to the page's own URL. */
const actionOn = (path: string) => ({
  url: `**${path}`,
  matches: isServerAction,
});

/** The platform answers busy (429) from here on, so the request is refused. */
const refusedAsBusy = (page: Page) => presentSession(page, "throttled");

const operations = (page: Page) =>
  page.locator("main li").filter({ hasText: "Operations" });

type Holding = {
  /** The request held in flight. */
  url: string;
  matches: (request: Request) => boolean;
  /** What the request needs first: a word typed, a refusal set. */
  prepare?: (page: Page, dialog: Locator) => Promise<void>;
  /** The control that sends it, and what it says while the answer is awaited. */
  send: string;
  busy: string;
  /** The dialog's own way out: disabled while it holds. */
  cancel: string;
  /** The answer, said once it arrives. */
  answered: (page: Page, dialog: Locator) => Promise<void>;
  /** Whether it stays open with its buttons back; an unlink's answer closes it. */
  staysOpen: boolean;
};

type Dialog = {
  /** Its accessible name. */
  name: string;
  /** A fixture state the page needs before it is opened. */
  state?: string;
  /** Where it is opened — by the owner, unless a session is named. */
  path: string;
  session?: "member";
  /** What the page needs first. */
  before?: (page: Page) => Promise<void>;
  /** The control that opens it. */
  opener: (page: Page) => Locator;
  /**
   * Opened only once a file is uploaded, which the browser PUTs to the
   * fixture's object store, whose certificate is the fixture's own.
   */
  files?: true;
  /** Until this, it is still sending: Webhook address reads on opening. */
  settled?: (dialog: Locator) => Promise<void>;
  /** How it holds while its request is in flight, if it sends one. */
  holds?: Holding;
};

const dialogs: Dialog[] = [
  {
    name: "Connect Fixture key provider",
    path: "/account/connections",
    opener: (page) =>
      connectionRow(page, "fixture-key").getByRole("button", {
        name: "Connect Fixture key provider",
      }),
  },
  {
    // Disconnect is confirmed first, as in the app (spec A4).
    name: "Disconnect Fixture OAuth provider?",
    path: "/account/connections",
    opener: (page) =>
      page
        .locator("main")
        .getByRole("button", { name: "Disconnect Fixture OAuth provider" }),
    holds: {
      ...actionOn("/account/connections"),
      prepare: refusedAsBusy,
      send: "Disconnect",
      busy: "Disconnecting…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    // A flow's page: its Connections, the same one row and its Disconnect,
    // asked first (Build 21, spec A4, A6).
    name: "Disconnect QuickBooks Online?",
    path: FLOWS.invoice,
    state: "quickbooks-connected",
    opener: (page) =>
      page
        .locator("main")
        .getByRole("button", { name: "Disconnect QuickBooks Online" }),
    holds: {
      ...actionOn(FLOWS.invoice),
      prepare: refusedAsBusy,
      send: "Disconnect",
      busy: "Disconnecting…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    name: "Archive Archivable automation?",
    path: FLOWS.archivable,
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Archive flow" }),
  },
  {
    name: "Move Webhook automation to v2?",
    path: FLOWS.webhook,
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Move to v2" }),
    holds: {
      ...actionOn(FLOWS.webhook),
      prepare: () => fixtureControl("approval-pending-on-move"),
      send: "Move to v2",
      busy: "Moving…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(
          "An approval for this flow is still waiting. Decide it first, then move.",
        ),
      staysOpen: true,
    },
  },
  {
    name: "Webhook address",
    path: FLOWS.webhook,
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Webhook address" }),
    settled: (dialog) =>
      expect(
        dialog.getByRole("button", { name: "Create address" }),
      ).toBeEnabled(),
    holds: {
      ...actionOn(FLOWS.webhook),
      send: "Create address",
      busy: "Working…",
      cancel: "Close",
      // The secret exists only in this answer.
      answered: (_, dialog) =>
        expect(dialog.getByText("fixture-secret-1")).toBeVisible(),
      staysOpen: true,
    },
  },
  {
    name: "Cancel this run?",
    path: "/account/runs/fixture-run-running",
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Cancel run" }),
    holds: {
      ...actionOn("/account/runs/fixture-run-running"),
      prepare: refusedAsBusy,
      send: "Cancel run",
      busy: "Cancelling…",
      cancel: "Keep it running",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    name: "Delete account?",
    path: "/account/settings",
    opener: (page) =>
      page
        .locator("main")
        .getByRole("button", { name: "Delete Account", exact: true }),
    holds: {
      // The page's own call, through the website's proxy.
      url: "**/api/platform/v1/account",
      matches: (request) => request.method() === "DELETE",
      send: "Yes, delete my account",
      busy: "Deleting…",
      cancel: "Cancel",
      // The owner's deletion is refused 409, and the account kept.
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toContainText(
          "your account is still here",
        ),
      staysOpen: true,
    },
  },
  {
    name: "Unlink Microsoft?",
    path: "/account/settings",
    opener: (page) =>
      page
        .locator("main li")
        .filter({ hasText: "Microsoft" })
        .getByRole("button", { name: "Unlink" }),
    holds: {
      url: "**/api/platform/v1/auth/identities/microsoft",
      matches: (request) => request.method() === "DELETE",
      send: "Unlink",
      busy: "Unlinking…",
      cancel: "Cancel",
      // Answered, it closes itself, and the account is offered to link again.
      answered: async (page) => {
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(
          page
            .locator("main li")
            .filter({ hasText: "Microsoft" })
            .getByRole("link", { name: "Link" }),
        ).toBeVisible();
      },
      staysOpen: false,
    },
  },
  {
    name: "Withdraw your request to join Operations?",
    path: "/account/teams",
    session: "member",
    // Asked first, so there is a request to withdraw.
    before: async (page) => {
      await operations(page)
        .getByRole("button", { name: "Request to join" })
        .click();
      await expect(
        operations(page).getByRole("button", { name: "Withdraw" }),
      ).toBeVisible();
    },
    opener: (page) =>
      operations(page).getByRole("button", { name: "Withdraw" }),
    holds: {
      ...actionOn("/account/teams"),
      prepare: refusedAsBusy,
      send: "Withdraw",
      busy: "Withdrawing…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    name: "Leave “general”?",
    path: team,
    session: "member",
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Leave team" }),
    holds: {
      ...actionOn(team),
      prepare: async (page, dialog) => {
        await dialog.getByLabel("Confirmation").fill("DELETE");
        await refusedAsBusy(page);
      },
      send: "Leave team",
      busy: "Leaving…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    name: "Remove Fixture Member?",
    path: "/account/organization",
    opener: (page) =>
      page
        .locator("main li")
        .filter({ hasText: "Fixture Member" })
        .getByRole("button", { name: "Remove", exact: true }),
    holds: {
      ...actionOn("/account/organization"),
      prepare: refusedAsBusy,
      send: "Remove member",
      busy: "Removing…",
      cancel: "Cancel",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
  {
    name: "Add members",
    path: team,
    opener: (page) =>
      page.locator("main").getByRole("button", { name: "Add members" }),
    holds: {
      ...actionOn(team),
      prepare: refusedAsBusy,
      send: "Add",
      busy: "Adding…",
      cancel: "Done",
      answered: (_, dialog) =>
        expect(dialog.getByRole("alert")).toHaveText(busy),
      staysOpen: true,
    },
  },
];

async function open(page: Page, dialog: Dialog): Promise<Locator> {
  if (dialog.state) await fixtureControl(dialog.state);
  if (dialog.session) await presentSession(page, dialog.session);
  await page.goto(dialog.path);
  await dialog.before?.(page);
  await dialog.opener(page).click();
  const opened = page.getByRole("dialog", { name: dialog.name, exact: true });
  await expect(opened).toBeVisible();
  await dialog.settled?.(opened);
  return opened;
}

/** Sends the dialog's request and holds it in flight, the dialog waiting. */
async function send(page: Page, opened: Locator, holds: Holding) {
  await holds.prepare?.(page, opened);
  const held = await holdRequest(page, holds.url, holds.matches);
  await opened.getByRole("button", { name: holds.send, exact: true }).click();
  await held.arrived;
  return held;
}

/**
 * Presses Escape the moment the button that waited is enabled again — from a
 * mutation observer, which runs before any effect that runs after the commit —
 * so the dialog must be dismissible in that same commit (register F72).
 */
function escapeOnceEnabled(waiting: string) {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((candidate) => candidate.textContent?.trim() === waiting);
  if (!button) throw new Error(`no "${waiting}" button waits in the dialog`);
  new MutationObserver((_, observer) => {
    if (button.disabled) return;
    observer.disconnect();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  }).observe(button, { attributes: true, attributeFilter: ["disabled"] });
}

for (const dialog of dialogs) {
  test.describe(dialog.name, () => {
    if (dialog.files) test.use({ ignoreHTTPSErrors: true });
    test("Escape closes it while it sends nothing, and focus goes back to the control that opened it", async ({
      page,
    }) => {
      const opened = await open(page, dialog);
      // Tab first, so focus is inside it: a dialog that had not taken focus yet
      // (Webhook address's controls wait on its read) would leave it on the
      // opener, and this would pass with nothing giving focus back.
      await page.keyboard.press("Tab");
      await expect(opened.locator(":focus")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(opened).toHaveCount(0);
      await expect(dialog.opener(page)).toBeFocused();
    });

    test("a click outside it closes it while it sends nothing", async ({
      page,
    }) => {
      const opened = await open(page, dialog);
      await page.mouse.click(4, 4);
      await expect(opened).toHaveCount(0);
    });

    const { holds } = dialog;
    if (holds) {
      test("it holds while its request is in flight — against Escape, a click outside and its own way out — and says the answer once it arrives (register F76)", async ({
        page,
      }) => {
        const opened = await open(page, dialog);
        const held = await send(page, opened, holds);
        await page.keyboard.press("Escape");
        await page.mouse.click(4, 4);
        await expect(opened).toBeVisible();
        await expect(
          opened.getByRole("button", { name: holds.cancel, exact: true }),
        ).toBeDisabled();
        held.release();
        await holds.answered(page, opened);
      });
    }

    if (holds?.staysOpen) {
      test("an Escape pressed the moment its buttons come back closes it (register F72)", async ({
        page,
      }) => {
        const opened = await open(page, dialog);
        const held = await send(page, opened, holds);
        await page.evaluate(escapeOnceEnabled, holds.busy);
        held.release();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });
    }
  });
}
