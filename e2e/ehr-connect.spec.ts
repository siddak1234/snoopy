import { expect, test, type Page } from "@playwright/test";
import {
  connectionRow,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
} from "./helpers";

/**
 * Round 21, Stage 2 on the website, against the loopback fixture Edge, reset
 * before each test (its surfaces: `e2e/fixtures/health-data.ts`): Connect
 * your EHR (backend ADR-0050, D1) — the key form with the clinic's FHIR
 * address, a vendor picker only for two or more vendors, each refusal in
 * words, and the row named by the clinic's host. Every word is the spec's
 * (`lib/smart-backend.ts`) or the platform's (the provider's own fields). The
 * health data agreement (C3) is `e2e/health-data.spec.ts`.
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
  await fixtureControl("ehr-offered?vendors=2");
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
  await fixtureControl("ehr-offered?vendors=1");
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
