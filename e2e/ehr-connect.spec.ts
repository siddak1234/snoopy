import { expect, test, type Page } from "@playwright/test";
import {
  connectionRow,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
} from "./helpers";

/**
 * The EHR on the website, against the loopback fixture Edge, reset before
 * each test (its surfaces: `e2e/fixtures/health-data.ts`). Round 21, Stage 2:
 * Connect your EHR as SMART Backend Services (backend ADR-0050, D1) — the key
 * form with the clinic's FHIR address, a vendor picker only for two or more
 * vendors, each refusal in words, and the row named by the clinic's host.
 * Round 22: the EHR a person signs in to (ADR-0054) — the same fields, a
 * button named by the vendor, the platform's return, each refusal at the
 * begin and on the way back, Sign in again and Replace; a flow in ICD-10 Code
 * Check v6's shape choosing the EHR on Set up; and a run an EHR started,
 * said on Activity and its page (ADR-0053). Every word is the spec's
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
  const again = row.getByRole("button", { name: "Sign in to EHR again" });
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

const EHR_FLOW_SETUP =
  "/account/flows/c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6/setup";

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

test("R22: in v6's shape, an EHR not yet signed in to is not connected, and an owner's tap goes to Connections to sign in", async ({
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
  await expect(page).toHaveURL(/\/account\/connections$/u);
  await expect(
    connectionRow(page, "ehr-fhir").getByRole("button", {
      name: "Connect EHR",
    }),
  ).toBeVisible();
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
