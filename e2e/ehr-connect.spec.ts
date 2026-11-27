import { expect, test, type Page } from "@playwright/test";
import {
  connectionRow,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  holdRequest,
  isServerAction,
} from "./helpers";

/**
 * The EHR on the website, against the loopback fixture Edge, reset before
 * each test (its surfaces: `e2e/fixtures/health-data.ts`). Round 21, Stage 2:
 * Connect your EHR as SMART Backend Services (backend ADR-0050, D1) — the key
 * form with the clinic's FHIR address, a vendor picker only for two or more
 * vendors, each refusal in words, and the row named by the clinic's host.
 * Round 22: the EHR a person signs in to (ADR-0054) — the same fields, a
 * button named by the vendor, the platform's return, Cancel, a sign-in the
 * platform reuses, each refusal at the begin and on the way back, Sign in
 * again (to the same address, no question) and Replace (only for the values
 * refused, never for values changed while the begin was asked, and only once
 * the connection it names is known); a flow in ICD-10 Code Check v6's shape
 * choosing the EHR on Set up, signed in to from Set up and back to it, and on
 * Connect integration, signed in to there and saved; and a run an EHR
 * started, said on Activity and its page (ADR-0053). Every word is the spec's
 * (`lib/smart-backend.ts`, `lib/run-progress.ts`) or the platform's (the
 * provider's own fields). The health data agreement (C3) is
 * `e2e/health-data.spec.ts`.
 */

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test.beforeEach(async () => {
  await fixtureControl("reset");
});

type Health = {
  ehrConnects: { key: string | null; credentials: Record<string, unknown> }[];
  ehrSignIns: {
    credentials: Record<string, unknown>;
    replaceConnectionId?: string;
  }[];
};
const health = async () =>
  (await fixtureRead<{ health: Health }>("counts")).health;

/** Connections' EHR row, its Connect pressed: the key form, open. */
async function openEhrForm(page: Page) {
  await page.goto("/account/connections");
  await connectionRow(page, "ehr-fhir")
    .getByRole("button", { name: "Connect EHR" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("D1: with two vendors, the EHR's Connect opens the key form — a picker of Epic (test system) and Epic, the FHIR address with its help — and Verify and connect sends the vendor picked and the address; the row then names the clinic's host", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2&auth=smart-backend");
  const dialog = await openEhrForm(page);
  const vendors = dialog.getByRole("radiogroup", { name: "EHR" });
  await expect(vendors.getByRole("radio")).toHaveCount(2);
  await expect(vendors).toContainText("Epic (test system)");
  await expect(dialog).toContainText("Your EHR team gives you this address.");
  await expectNoAxeViolations(page);
  await vendors.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.clinic.example.test/api/FHIR/R4");
  await dialog.getByRole("button", { name: "Verify and connect" }).click();
  await expect(dialog).toHaveCount(0);
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("fhir.clinic.example.test");
  await expect(
    row.getByRole("button", { name: "Disconnect EHR" }),
  ).toBeVisible();
  expect(
    (await health()).ehrConnects.map(({ credentials }) => credentials),
  ).toEqual([
    {
      vendor: "epic",
      fhirBaseUrl: "https://fhir.clinic.example.test/api/FHIR/R4",
    },
  ]);
});

test("D1: with one vendor there is no picker, and that vendor is sent unseen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1&auth=smart-backend");
  const dialog = await openEhrForm(page);
  await expect(dialog.getByRole("radiogroup")).toHaveCount(0);
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.clinic.example.test/api/FHIR/R4");
  await dialog.getByRole("button", { name: "Verify and connect" }).click();
  await expect(connectionRow(page, "ehr-fhir")).toContainText(
    "fhir.clinic.example.test",
  );
  expect((await health()).ehrConnects[0].credentials.vendor).toBe("epic-test");
});

test("D1: each address the EHR's connect will not use is said in its words, in the form, which keeps what was typed", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1&auth=smart-backend");
  const dialog = await openEhrForm(page);
  const address = dialog.getByLabel("FHIR address");
  for (const [typed, said] of [
    [
      "http://fhir.clinic.example.test/api/FHIR/R4",
      "Use the https address your EHR team gave you.",
    ],
    [
      "https://silent.example.test/fhir",
      "That address didn't answer as a FHIR server.",
    ],
    [
      "https://inactive.example.test/fhir",
      "Your EHR hasn't turned on Autom8x yet. Ask your EHR team to activate it.",
    ],
  ]) {
    await address.fill(typed);
    await dialog.getByRole("button", { name: "Verify and connect" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(said);
    await expect(address).toHaveValue(typed);
  }
  await expect(connectionRow(page, "ehr-fhir")).toContainText("Not connected");
});

// Round 22: the EHR a person signs in to (backend ADR-0054).

const ADDRESS = "https://fhir.clinic.example.test/api/FHIR/R4";

test("R22: with two vendors, the EHR's Connect opens the sign-in form — a picker of Epic (test system) and Epic, the FHIR address with its help — its button named by the vendor picked; Sign in with Epic goes through the EHR and back to Connections, connected, the row naming the clinic's host", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  const dialog = await openEhrForm(page);
  const vendors = dialog.getByRole("radiogroup", { name: "EHR" });
  await expect(vendors.getByRole("radio")).toHaveCount(2);
  await expect(dialog).toContainText("Your EHR team gives you this address.");
  await expect(
    dialog.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Verify and connect" }),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
  await vendors.getByRole("radio", { name: "Epic (test system)" }).check();
  await expect(
    dialog.getByRole("button", { name: "Sign in with Epic (test system)" }),
  ).toBeVisible();
  await vendors.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/connections\?status=connected$/u);
  await expect(page.locator("main").getByRole("status")).toHaveText(
    "Connection completed successfully.",
  );
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("fhir.clinic.example.test");
  await expect(
    row.getByRole("button", { name: "Disconnect EHR" }),
  ).toBeVisible();
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);
  expect((await health()).ehrConnects).toEqual([]);
});

test("R22: with one vendor there is no picker; the button names it, and it is sent unseen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  const dialog = await openEhrForm(page);
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic (test system)" })
    .click();
  await expect(connectionRow(page, "ehr-fhir")).toContainText(
    "fhir.clinic.example.test",
  );
  expect((await health()).ehrSignIns[0].credentials.vendor).toBe("epic-test");
});

test("R22: each address the sign-in will not begin with is said in its words, in the form, which keeps what was typed", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  const dialog = await openEhrForm(page);
  const address = dialog.getByLabel("FHIR address");
  for (const [typed, said] of [
    [
      "http://fhir.clinic.example.test/api/FHIR/R4",
      "Use the https address your EHR team gave you.",
    ],
    [
      "https://silent.example.test/fhir",
      "That address didn't answer as a FHIR server.",
    ],
    [
      "https://unsupported.example.test/fhir",
      "That EHR doesn't offer the sign-in Autom8x uses. Ask your EHR team.",
    ],
  ]) {
    await address.fill(typed);
    await dialog
      .getByRole("button", { name: "Sign in with Epic (test system)" })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(said);
    await expect(address).toHaveValue(typed);
  }
  await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
  await expect(connectionRow(page, "ehr-fhir")).toContainText("Not connected");
});

test("R22: a sign-in refused on the way back says why, in the spec's words, on Connections; nothing is connected", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  for (const [typed, said] of [
    [
      "https://no-refresh.example.test/fhir",
      "Your EHR team needs to allow a lasting sign-in for Autom8x. Ask them, then sign in again.",
    ],
    [
      "https://token-refused.example.test/fhir",
      "Use the https address your EHR team gave you.",
    ],
    [
      "https://token-silent.example.test/fhir",
      "That address didn't answer as a FHIR server.",
    ],
  ]) {
    const dialog = await openEhrForm(page);
    await dialog.getByLabel("FHIR address").fill(typed);
    await dialog
      .getByRole("button", { name: "Sign in with Epic (test system)" })
      .click();
    await expect(page).toHaveURL(
      /\/account\/connections\?status=error&reason=/u,
    );
    await expect(page.locator("main").getByRole("alert")).toHaveText(said);
    await expect(connectionRow(page, "ehr-fhir")).toContainText(
      "Not connected",
    );
  }
});

test("R22: a sign-in the platform asks for again says Sign in again; another address asks Replace it?, and Replace signs in over the old one", async ({
  page,
}) => {
  await fixtureControl("ehr-sign-in-again");
  await page.goto("/account/connections");
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("Needs attention");
  await expect(row.getByRole("button", { name: "Reconnect EHR" })).toHaveCount(
    0,
  );
  const again = row.getByRole("button", { name: "Sign in again to EHR" });
  await expect(again).toHaveText("Sign in again");
  await again.click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.other.example.test/api/FHIR/R4");
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address. Replace it?",
  );
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(page).toHaveURL(/\/account\/connections\?status=connected$/u);
  await expect(connectionRow(page, "ehr-fhir")).toContainText(
    "fhir.other.example.test",
  );
  const signIns = (await health()).ehrSignIns;
  expect(signIns.map((signIn) => signIn.replaceConnectionId ?? null)).toEqual([
    null,
    "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4",
  ]);
  expect(signIns[1].credentials).toEqual({
    vendor: "epic",
    fhirBaseUrl: "https://fhir.other.example.test/api/FHIR/R4",
  });
});

/** Connections' EHR row needing its sign-in again, pressed: the sign-in form, open. */
async function openSignInAgain(page: Page) {
  await page.goto("/account/connections");
  await connectionRow(page, "ehr-fhir")
    .getByRole("button", { name: "Sign in again to EHR" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("R22: signing in again to the same address asks nothing — no Replace — and it is connected again", async ({
  page,
}) => {
  await fixtureControl("ehr-sign-in-again");
  const dialog = await openSignInAgain(page);
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/connections\?status=connected$/u);
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("fhir.clinic.example.test");
  await expect(
    row.getByRole("button", { name: "Disconnect EHR" }),
  ).toBeVisible();
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);
});

test("R22: Replace answers only the values refused — a change to a field takes the question back, and Replace sends what the form holds now (the session's D3)", async ({
  page,
}) => {
  await fixtureControl("ehr-sign-in-again");
  const dialog = await openSignInAgain(page);
  const address = dialog.getByLabel("FHIR address");
  const signIn = dialog.getByRole("button", {
    name: "Sign in with Epic",
    exact: true,
  });
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await address.fill("https://fhir.other.example.test/api/FHIR/R4");
  await signIn.click();
  await expect(dialog.getByRole("button", { name: "Replace" })).toBeVisible();
  await address.fill("https://fhir.third.example.test/api/FHIR/R4");
  await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await signIn.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address. Replace it?",
  );
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(page).toHaveURL(/\/account\/connections\?status=connected$/u);
  await expect(connectionRow(page, "ehr-fhir")).toContainText(
    "fhir.third.example.test",
  );
  const signIns = (await health()).ehrSignIns;
  expect(signIns).toHaveLength(3);
  expect(signIns[2]).toEqual({
    credentials: {
      vendor: "epic",
      fhirBaseUrl: "https://fhir.third.example.test/api/FHIR/R4",
    },
    replaceConnectionId: "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4",
  });
});

test("R22: a 409 for a sign-in this page did not know of says the first sentence alone, reads the connections again, then asks Replace it? — and Replace names that connection (the session's D3)", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  const dialog = await openEhrForm(page);
  // Signed in elsewhere since this page read the connections.
  await fixtureControl("ehr-connected");
  // The read again is held until the words before it are seen.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/account/connections**", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.headers()["rsc"] === "1")
      await held;
    await route.continue();
  });
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.other.example.test/api/FHIR/R4");
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address.",
  );
  await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
  release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address. Replace it?",
  );
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(page).toHaveURL(/\/account\/connections\?status=connected$/u);
  const signIns = (await health()).ehrSignIns;
  expect(signIns.map((signIn) => signIn.replaceConnectionId ?? null)).toEqual([
    null,
    "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4",
  ]);
});

const EHR_FLOW = "/account/flows/c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6";
const EHR_FLOW_SETUP = `${EHR_FLOW}/setup`;

test("R22: a flow in v6's shape draws its optional EHR in its Connections section with the generic code; connected, the EHR is chosen and Save saves it", async ({
  page,
}) => {
  await fixtureControl("ehr-connected");
  await fixtureControl("ehr-flow");
  await page.goto(EHR_FLOW_SETUP);
  const section = page.getByRole("group", { name: "Connections" });
  const choice = section.getByRole("radiogroup", { name: "EHR" });
  await expect(choice.getByRole("radio")).toHaveText([
    /EHRfhir\.clinic\.example\.test/u,
    /None/u,
  ]);
  await expect(choice.getByRole("radio", { name: "None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expectNoAxeViolations(page);
  await choice.getByRole("radio", { name: "EHR" }).click();
  await expect(choice.getByRole("radio", { name: "EHR" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/account\/flows\/c6c6c6c6-[^/]+$/u);
  const { ehrFlowSaves } = await fixtureRead<{
    ehrFlowSaves: Record<string, unknown>[];
  }>("counts");
  expect(ehrFlowSaves).toHaveLength(1);
  expect(ehrFlowSaves[0].ehr).toBe("ehr-fhir");
});

test("R22: in v6's shape, an EHR not yet signed in to is not connected; an owner's tap opens the sign-in on Set up, which comes back to Set up with the EHR chosen, and Save saves it (the session's D4)", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  await fixtureControl("ehr-flow");
  await page.goto(EHR_FLOW_SETUP);
  const choice = page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" });
  await expect(choice.getByRole("radio", { name: "EHR" })).toContainText(
    "Not connected",
  );
  await choice.getByRole("radio", { name: "EHR" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/setup$/u);
  await expect(
    dialog.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/account\/flows\/c6c6c6c6-[^/]+\/setup\?status=connected$/u,
  );
  await expect(page.locator("main").getByRole("status")).toHaveText(
    "Connection completed successfully.",
  );
  const ehr = page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" })
    .getByRole("radio", { name: "EHR" });
  await expect(ehr).toHaveAttribute("aria-checked", "true");
  await expect(ehr).toContainText("fhir.clinic.example.test");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/account\/flows\/c6c6c6c6-[^/]+$/u);
  const { ehrFlowSaves } = await fixtureRead<{
    ehrFlowSaves: Record<string, unknown>[];
  }>("counts");
  expect(ehrFlowSaves).toHaveLength(1);
  expect(ehrFlowSaves[0].ehr).toBe("ehr-fhir");
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);
});

test("R22: a sign-in started on Set up and refused on the way back comes back to Set up, saying why in the spec's words; nothing is chosen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  await fixtureControl("ehr-flow");
  await page.goto(EHR_FLOW_SETUP);
  await page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" })
    .getByRole("radio", { name: "EHR" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await dialog
    .getByLabel("FHIR address")
    .fill("https://no-refresh.example.test/fhir");
  await dialog
    .getByRole("button", { name: "Sign in with Epic (test system)" })
    .click();
  await expect(page).toHaveURL(
    /\/account\/flows\/c6c6c6c6-[^/]+\/setup\?status=error&reason=no_refresh_token$/u,
  );
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Your EHR team needs to allow a lasting sign-in for Autom8x. Ask them, then sign in again.",
  );
  const choice = page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" });
  await expect(choice.getByRole("radio", { name: "EHR" })).toContainText(
    "Not connected",
  );
  await expect(choice.getByRole("radio", { name: "None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("R22: on Set up too, a 409 for a sign-in the page did not know of reads the connections again, then asks Replace it?, and Replace comes back to Set up with the EHR chosen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  await fixtureControl("ehr-flow");
  await page.goto(EHR_FLOW_SETUP);
  await page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" })
    .getByRole("radio", { name: "EHR" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  await fixtureControl("ehr-connected");
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/account/flows/*/setup**", async (route) => {
    const request = route.request();
    if (request.method() === "GET" && request.headers()["rsc"] === "1")
      await held;
    await route.continue();
  });
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.other.example.test/api/FHIR/R4");
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address.",
  );
  release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace is signed in to another EHR address. Replace it?",
  );
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(page).toHaveURL(
    /\/account\/flows\/c6c6c6c6-[^/]+\/setup\?status=connected$/u,
  );
  await expect(
    page
      .getByRole("group", { name: "Connections" })
      .getByRole("radiogroup", { name: "EHR" })
      .getByRole("radio", { name: "EHR" }),
  ).toHaveAttribute("aria-checked", "true");
  const signIns = (await health()).ehrSignIns;
  expect(signIns.map((signIn) => signIn.replaceConnectionId ?? null)).toEqual([
    null,
    "e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4",
  ]);
});

/** Set up's EHR choice, in its Connections section. */
const setupEhrChoice = (page: Page) =>
  page
    .getByRole("group", { name: "Connections" })
    .getByRole("radiogroup", { name: "EHR" });

test("R22: the sign-in form's Cancel closes it and begins nothing — on Connections, the EHR still not connected, and on Set up, None still chosen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  await fixtureControl("ehr-flow");
  const dialog = await openEhrForm(page);
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(connectionRow(page, "ehr-fhir")).toContainText("Not connected");
  expect((await health()).ehrSignIns).toEqual([]);

  await page.goto(EHR_FLOW_SETUP);
  const choice = setupEhrChoice(page);
  await choice.getByRole("radio", { name: "EHR" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(setupDialog).toBeVisible();
  await setupDialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await setupDialog.getByLabel("FHIR address").fill(ADDRESS);
  await setupDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(setupDialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/setup$/u);
  await expect(choice.getByRole("radio", { name: "None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(choice.getByRole("radio", { name: "EHR" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect((await health()).ehrSignIns).toEqual([]);
});

test("R22: a sign-in the platform reuses — signed in elsewhere since the page read the connections — closes the form and says as whom on Connections; on Set up it closes the form with the EHR chosen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  const dialog = await openEhrForm(page);
  // Signed in elsewhere, to this address, since this page read the connections.
  await fixtureControl("ehr-connected");
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(page.locator("main").getByRole("status")).toHaveText(
    "EHR is already connected as fhir.clinic.example.test, with everything it needs — there is nothing to authorize.",
  );
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/account\/connections$/u);
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("fhir.clinic.example.test");
  await expect(
    row.getByRole("button", { name: "Disconnect EHR" }),
  ).toBeVisible();
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);

  // Set up, from the fixture's first state.
  await fixtureControl("reset");
  await fixtureControl("ehr-offered?vendors=2");
  await fixtureControl("ehr-flow");
  await page.goto(EHR_FLOW_SETUP);
  const ehr = setupEhrChoice(page).getByRole("radio", { name: "EHR" });
  await expect(ehr).toContainText("Not connected");
  await ehr.click();
  const setupDialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(setupDialog).toBeVisible();
  await fixtureControl("ehr-connected");
  await setupDialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await setupDialog.getByLabel("FHIR address").fill(ADDRESS);
  await setupDialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(setupDialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/setup$/u);
  await expect(ehr).toHaveAttribute("aria-checked", "true");
  await expect(ehr).toContainText("fhir.clinic.example.test");
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);
});

test("R22: on Connect integration, an owner's tap on the EHR not yet signed in to opens its sign-in there; back connected, the EHR is saved and the page goes back to the flow", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  await fixtureControl("ehr-flow");
  await page.goto(`${EHR_FLOW}/vendor?field=ehr`);
  const ehr = page
    .getByRole("radiogroup", { name: "Connect integration" })
    .getByRole("radio", { name: "EHR" });
  await expect(ehr).toContainText("Not connected");
  await ehr.click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/vendor\?field=ehr$/u);
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog.getByLabel("FHIR address").fill(ADDRESS);
  await dialog
    .getByRole("button", { name: "Sign in with Epic", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/flows\/c6c6c6c6-[^/]+$/u);
  const { ehrFlowSaves } = await fixtureRead<{
    ehrFlowSaves: Record<string, unknown>[];
  }>("counts");
  expect(ehrFlowSaves).toHaveLength(1);
  expect(ehrFlowSaves[0].ehr).toBe("ehr-fhir");
  expect((await health()).ehrSignIns).toEqual([
    { credentials: { vendor: "epic", fhirBaseUrl: ADDRESS } },
  ]);
});

test("R22: a 409 for values changed while the begin was asked offers nothing — no Replace, no words — and the form keeps what was typed since (the session's D3)", async ({
  page,
}) => {
  await fixtureControl("ehr-sign-in-again");
  const dialog = await openSignInAgain(page);
  const address = dialog.getByLabel("FHIR address");
  const signIn = dialog.getByRole("button", {
    name: "Sign in with Epic",
    exact: true,
  });
  await dialog.getByRole("radio", { name: "Epic", exact: true }).check();
  await address.fill("https://fhir.other.example.test/api/FHIR/R4");
  // The begin is held until the address has changed under it.
  const begin = await holdRequest(
    page,
    "**/account/connections**",
    isServerAction,
  );
  await signIn.click();
  await begin.arrived;
  await address.fill("https://fhir.third.example.test/api/FHIR/R4");
  begin.release();
  // The begin's answer is in once the button is itself again.
  await expect(signIn).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(address).toHaveValue(
    "https://fhir.third.example.test/api/FHIR/R4",
  );
  expect((await health()).ehrSignIns).toEqual([
    {
      credentials: {
        vendor: "epic",
        fhirBaseUrl: "https://fhir.other.example.test/api/FHIR/R4",
      },
    },
  ]);
});

test("R22: a run an EHR started says so on Activity and on its page, steps or result; a person's start says nothing new", async ({
  page,
}) => {
  await fixtureControl("runs-started-by");
  await page.goto("/account/runs");
  const rows = page.getByTestId("activity-runs").getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(
    page.getByTestId("activity-runs").getByTestId("run-started-by"),
  ).toHaveText(["Started from your EHR", "Started from your EHR"]);
  await expect(
    rows
      .filter({ hasText: "fixture-run-failed" })
      .getByTestId("run-started-by"),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
  for (const [runId, said] of [
    ["fixture-run-ok", "Started from your EHR"],
    ["fixture-run-running", "Started from your EHR"],
    ["fixture-run-failed", null],
  ] as const) {
    await page.goto(`/account/runs/${runId}`);
    await expect(page.getByTestId("run-details-row")).toBeVisible();
    if (said) await expect(page.getByTestId("run-started-by")).toHaveText(said);
    else await expect(page.getByTestId("run-started-by")).toHaveCount(0);
  }
});
