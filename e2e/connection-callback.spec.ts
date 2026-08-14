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
