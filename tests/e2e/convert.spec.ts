import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";

const png = readFileSync(resolve(__dirname, "../fixtures/sample.png"));

test("PNG converts locally to downloadable WebP at selected quality", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "文件转换" })).toBeVisible();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("sample.png")).toBeVisible();
  await page.getByLabel("目标格式").selectOption("webp");
  await page.getByLabel(/画质/).fill("72");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.webp" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sample.webp");
  const bytes = await readFile(await download.path());
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
});

test("unsupported signature does not block a valid file", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles([
    { name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") },
    { name: "sample.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByText("1 个待转换 · 1 个不支持")).toBeVisible();
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
});

test("JPG and WebP convert in one batch and ZIP contains both outputs", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles([
    { name: "sample.jpg", mimeType: "image/jpeg", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.jpg")) },
    { name: "sample.webp", mimeType: "image/webp", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.webp")) },
  ]);
  await page.getByLabel("目标格式").selectOption("png");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("2 个已完成");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载全部" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^convertbox_\d{4}-\d{2}-\d{2}\.zip$/);
  const entries = unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(Object.keys(entries).sort()).toEqual(["sample.png", "sample_1.png"]);
  for (const bytes of Object.values(entries)) expect(Array.from(bytes.slice(0, 8))).toEqual([137,80,78,71,13,10,26,10]);
});

test("language switch rewrites the full workspace in English", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "File conversion" })).toBeVisible();
  await page.getByLabel("Choose files").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Convert to")).toBeVisible();
  await expect(page.getByText("Processed in your browser")).toBeVisible();
  await page.getByRole("button", { name: "切换为中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByLabel("目标格式")).toBeVisible();
});
