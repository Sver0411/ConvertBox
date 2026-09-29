import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const fixture = (name: string) => readFileSync(resolve(__dirname, "../fixtures", name));

test("home, signature detection, language and theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "文件转换" })).toBeVisible();
  await page.getByLabel("主题").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { name: "File conversion" })).toBeVisible();
  await page.getByLabel("Choose files").setInputFiles([
    { name: "sample.jpg", mimeType: "image/jpeg", buffer: fixture("sample.jpg") },
    { name: "sample.png", mimeType: "image/png", buffer: fixture("sample.png") },
    { name: "sample.webp", mimeType: "image/webp", buffer: fixture("sample.webp") },
  ]);
  await expect(page.locator(".file-row")).toHaveCount(3);
  await expect(page.locator(".file-row").nth(0)).toContainText("JPG");
  await expect(page.locator(".file-row").nth(1)).toContainText("PNG");
  await expect(page.locator(".file-row").nth(2)).toContainText("WEBP");
});

test("PNG to JPG fallback resizes and downloads a real image", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "OffscreenCanvas", { value: undefined, configurable: true }); });
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: fixture("sample.png") });
  await page.getByLabel("目标格式", { exact: true }).selectOption("jpg");
  await page.getByLabel("宽度（像素）").fill("8");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.jpg" }).click();
  const bytes = await readFile(await (await pending).path());
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  const dimensions = await page.evaluate(async data => {
    const blob = new Blob([new Uint8Array(data)], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    } finally { URL.revokeObjectURL(url); }
  }, Array.from(bytes));
  expect(dimensions).toEqual([8, 8]);
});

test("WebP output follows runtime encoding capability", async ({ page }) => {
  await page.goto("/");
  const supported = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  });
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: fixture("sample.png") });
  await expect(page.locator(".file-row")).toHaveCount(1);
  const options = await page.getByLabel("目标格式", { exact: true }).locator("option").allTextContents();
  if (!supported) {
    // The server may still advertise WebP even when the browser cannot encode it.
    if (options.includes("WEBP")) {
      await page.getByLabel("目标格式", { exact: true }).selectOption("webp");
      await expect(page.locator(".file-row")).toContainText("服务器");
    }
    return;
  }
  expect(options).toContain("WEBP");
  await page.getByLabel("目标格式", { exact: true }).selectOption("webp");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.webp" }).click();
  const bytes = await readFile(await (await pending).path());
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
});
