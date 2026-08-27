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
const visible = await payBtn.isVisible().catch(() => false);
const granted = await page.getByText(/You've been granted access/i).isVisible().catch(() => false);

await page.screenshot({ path: "/workspace/screenshots/qa-wallet.png", fullLength: true }).catch(() =>
  page.screenshot({ path: "/workspace/screenshots/qa-wallet.png", fullPage: true }),
);

if (granted) {
  console.error(JSON.stringify({ email, ok: false, reason: "buyer self-granted" }));
  await browser.close();
  process.exit(1);
}

console.log(JSON.stringify({ email, ok: true, checkoutVisible: visible, selfGranted: false }, null, 2));
await browser.close();
