import { chromium } from "playwright";

export async function fetchPageText(url) {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const title = await page.title();
  const text  = await page.locator("body").innerText();

  await browser.close();

  return { title, text: text.slice(0, 30000) };
}
