import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
const email = `wallet_${Date.now()}@collector.test`;
const password = "collector-yes-99";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  localStorage.setItem("sheundresses.age.ok", "1");
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
await page.getByRole("button", { name: /I am 18 or older/i }).click({ timeout: 2000 }).catch(() => undefined);
await page.getByText(/Need an invitation/i).click();
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.getByRole("button", { name: /Create collector access/i }).click();
await page.waitForTimeout(1500);

await page.goto(base + "/ladders/the-reveal?pay=true", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

const payBtn = page.getByRole("button", { name: /Pay with ETH/i });
await payBtn.waitFor({ state: "visible", timeout: 10000 });
await payBtn.click();
await page.waitForURL(/\/checkout\//, { timeout: 15000 });

await page.getByRole("button", { name: /Connect wallet/i }).click();
await page.getByRole("button", { name: /Vault wallet/i }).first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Pay /i }).click();
await page.getByText(/You've been granted access/i).waitFor({ timeout: 12000 });
await page.screenshot({ path: "/workspace/screenshots/qa-wallet.png", fullPage: true });
console.log(JSON.stringify({ email, granted: true, url: page.url() }, null, 2));
await browser.close();
