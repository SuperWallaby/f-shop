import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { devPorts, loadEnvLocal } from "./load_env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvLocal();
const { webPort } = devPorts();
const OUT = path.join(__dirname, "..", "screenshots");
const BASE = process.env.FASEA_APP_URL ?? `http://localhost:${webPort}`;
const EMAIL = process.env.FASEA_SCREENSHOT_EMAIL ?? "ui-review@fasea.test";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${file}`);
}

async function clickNav(page, label) {
  const btn = page.getByRole("button", { name: label, exact: true });
  await btn.waitFor({ timeout: 15000 });
  await btn.click();
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "01-auth");

  const email = page.locator('input[type="email"], input[aria-label="Email"], flt-semantics input').first();
  if ((await email.count()) > 0) {
    await email.fill(EMAIL);
    const continueBtn = page.getByRole("button", { name: /Continue/i });
    await continueBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, "02-after-login");

    const nameField = page.locator('input[aria-label="Full name"], input').first();
    if ((await nameField.count()) > 0 && (await page.getByText("Your name").count()) > 0) {
      await shot(page, "02b-complete-name");
      await nameField.fill("UI Review");
      await page.getByRole("button", { name: /Continue/i }).click();
      await page.waitForTimeout(2500);
    }

    await shot(page, "03-book-tab");
    const tabs = ["Membership", "Events", "Account"];
    for (let i = 0; i < tabs.length; i++) {
      await clickNav(page, tabs[i]);
      await shot(page, `0${4 + i}-${tabs[i].toLowerCase()}`);
    }
  } else {
    console.log("Could not find email field — semantics/DOM may differ; auth screenshot only.");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
