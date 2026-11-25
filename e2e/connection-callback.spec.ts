import { expect, test } from "@playwright/test";

test("the provider callback compatibility route keeps only the fixed status token", async ({
  page,
}) => {
  await page.goto(
    "/connections?status=error&provider=untrusted&reason=untrusted",
  );

  await expect(page).toHaveURL(
    /\/login\?callbackUrl=%2Faccount%2Fconnections%3Fstatus%3Derror$/,
  );
  await expect(page.getByText("untrusted", { exact: false })).toHaveCount(0);
});

test("a refused EHR sign-in's reason that has words travels on, and only that one (backend ADR-0054)", async ({
  page,
}) => {
  await page.goto(
    "/connections?status=error&provider=ehr-fhir&reason=no_refresh_token",
  );
  await expect(page).toHaveURL(
    /\/login\?callbackUrl=%2Faccount%2Fconnections%3Fstatus%3Derror%26reason%3Dno_refresh_token$/,
  );
  await page.goto("/connections?status=error&reason=constructor");
  await expect(page).toHaveURL(
    /\/login\?callbackUrl=%2Faccount%2Fconnections%3Fstatus%3Derror$/,
  );
});
