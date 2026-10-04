// Post-deploy production prober for /audit-change --live: verifies that the
// routes a merged change affects actually serve and render on the live site.
// Route-level only — interaction-level probes are composed by the session
// using the same chromium pattern. Never part of the push gate.
//
// Usage: node scripts/audit/live-probe.mjs /privacy /terms [...routes]
import { chromium } from "@playwright/test";

const ORIGIN = "https://www.autom8x.ai";
const routes = process.argv.slice(2);
if (routes.length === 0) {
  console.error("live-probe: pass at least one route, e.g. /privacy /terms");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
});
let failed = false;
for (const route of routes) {
  const url = `${ORIGIN}${route}`;
  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const status = response?.status() ?? 0;
    // Next's error overlay/page would render this marker text.
    const errorPage = await page
      .getByText("Application error: a client-side exception has occurred")
      .count();
    const headings = await page.locator("h1, h2").count();
    const ok = status === 200 && errorPage === 0 && headings > 0;
    console.log(
      `live-probe: ${route} status=${status} headings=${headings} errorPage=${errorPage} -> ${ok ? "OK" : "FAIL"}`,
    );
    if (!ok) failed = true;
  } catch (error) {
    console.log(`live-probe: ${route} -> FAIL (${error.message})`);
    failed = true;
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
