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
  await expect(page.getByText("Processed in your browser")).toHaveCount(0);
  await page.getByRole("button", { name: "切换为中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByLabel("目标格式")).toBeVisible();
});

test("local image resize preserves aspect ratio", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("目标格式", { exact: true }).selectOption("png");
  await page.getByLabel("宽度（像素）").fill("8");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.png" }).click();
  const bytes = await readFile(await (await pending).path());
  expect(bytes.readUInt32BE(16)).toBe(8);
  expect(bytes.readUInt32BE(20)).toBe(8);
});

test("PDF to PNG and Word to PDF run on the server", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.pdf", mimeType: "application/pdf", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.pdf")) });
  await expect(page.locator(".file-row")).toContainText("服务器");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成", { timeout: 20000 });
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.zip" }).click();
  const pdfZip = unzipSync(new Uint8Array(await readFile(await (await pdfDownload).path())));
  expect(Array.from(pdfZip["page_1.png"].slice(0, 8))).toEqual([137,80,78,71,13,10,26,10]);
  await page.getByRole("button", { name: "添加文件" }).click();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.docx")) });
  await page.getByRole("button", { name: "转换剩余文件" }).click();
  await expect(page.locator(".summary")).toContainText("2 个已完成", { timeout: 20000 });
  const officeDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.pdf" }).click();
  const officeBytes = await readFile(await (await officeDownload).path());
  expect(officeBytes.toString("ascii", 0, 5)).toBe("%PDF-");
});

test("audio and video produce real MP3 output", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.wav", mimeType: "audio/wav", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.wav")) });
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成", { timeout: 20000 });
  const audioDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.mp3" }).click();
  const audio = await readFile(await (await audioDownload).path());
  expect(audio.toString("ascii", 0, 3)).toBe("ID3");
  await page.getByRole("button", { name: "添加文件" }).click();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.mp4", mimeType: "video/mp4", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.mp4")) });
  await page.getByRole("button", { name: "转换剩余文件" }).click();
  await expect(page.locator(".summary")).toContainText("2 个已完成", { timeout: 20000 });
  const videoDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 sample.mp3" }).last().click();
  const extracted = await readFile(await (await videoDownload).path());
  expect(extracted.toString("ascii", 0, 3)).toBe("ID3");
});

test("preset, history and dark theme work together", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("主题").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".settings-panel")).toHaveCSS("background-color", "rgb(32, 45, 61)");
  await expect(page.locator(".setting-note")).toHaveCount(0);
  await page.getByLabel("预设").selectOption("web-image");
  await expect(page.getByLabel("目标格式", { exact: true })).toHaveValue("jpg");
  await expect(page.getByLabel("宽度（像素）")).toHaveValue("1920");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成");
  await page.getByRole("button", { name: "记录" }).click();
  await expect(page.locator(".history-row")).toContainText("PNG → JPG");
  await page.reload();
  await expect(page.locator(".history-row")).toContainText("PNG → JPG");
  await page.getByRole("button", { name: "清空记录" }).click();
  await expect(page.getByText("暂无记录")).toBeVisible();
});

test("image order controls the pages of a combined PDF", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("选择文件").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: png },
    { name: "second.jpg", mimeType: "image/jpeg", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.jpg")) },
  ]);
  await page.getByLabel("目标格式", { exact: true }).selectOption("pdf");
  await page.getByRole("button", { name: "上移 second.jpg" }).click();
  await expect(page.locator(".file-row .file-name").first()).toHaveText("second.jpg");
  await page.getByLabel("页面尺寸").selectOption("a4");
  await page.getByRole("button", { name: "合并为 PDF" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成", { timeout: 20000 });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 images.pdf" }).click();
  const bytes = await readFile(await (await pending).path());
  expect(bytes.toString("ascii", 0, 5)).toBe("%PDF-");
});

test("sidebar opens focused Word and PDF workspaces without page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Word/ }).click();
  await expect(page.getByRole("heading", { name: "Word 转换" })).toBeVisible();
  await expect(page).toHaveURL(/tool=word/);
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.docx")) });
  await expect(page.getByLabel("目标格式", { exact: true })).toHaveValue("pdf");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PDF 转换" })).toBeVisible();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.pdf", mimeType: "application/pdf", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.pdf")) });
  const formatTop = await page.locator("#format").evaluate(element => element.getBoundingClientRect().top);
  const operationTop = await page.locator("#pdf-operation").evaluate(element => element.getBoundingClientRect().top);
  const dpiTop = await page.locator("#dpi").evaluate(element => element.getBoundingClientRect().top);
  expect(Math.abs(formatTop - operationTop)).toBeLessThan(3);
  expect(Math.abs(formatTop - dpiTop)).toBeLessThan(3);
  await page.getByRole("button", { name: "记录" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toBeVisible();
  await page.getByRole("button", { name: "说明" }).click();
  await expect(page.getByRole("heading", { name: "关于 ConvertBox" })).toBeVisible();
});

test("Word workspace exposes PDF to DOCX and keeps other queued files separate", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Word/ }).click();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.pdf", mimeType: "application/pdf", buffer: readFileSync(resolve(__dirname, "../fixtures/sample.pdf")) });
  await expect(page.getByLabel("目标格式", { exact: true })).toHaveValue("docx");
  await page.getByRole("button", { name: "图片" }).click();
  await page.getByLabel("选择文件").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".file-row")).toHaveCount(1);
  await page.getByRole("button", { name: /^Word/ }).click();
  await expect(page.locator(".file-row")).toHaveCount(1);
  await expect(page.locator(".file-name")).toHaveText("sample.pdf");
  await page.getByRole("button", { name: "开始转换" }).click();
  await expect(page.locator(".summary")).toContainText("1 个已完成", { timeout: 20000 });
  await page.getByRole("button", { name: "图片" }).click();
  await expect(page.locator(".file-name")).toHaveText("sample.png");
  await expect(page.locator(".status-pill")).toContainText("待转换");
});
