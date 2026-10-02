import { expect, test } from "@playwright/test";

test("tool search, favorite, stable URL and recent tool persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "选择工具" })).toBeVisible();
  await page.getByLabel("搜索工具", { exact: true }).fill("图片");
  await page.getByRole("button", { name: "收藏 图片格式转换", exact: true }).click();
  await page.getByRole("link", { name: /图片格式转换/ }).click();
  await expect(page).toHaveURL(/\/tools\/image\/convert$/);
  await expect(page.getByLabel("选择文件")).toBeAttached();
  await page.getByRole("link", { name: "工具中心" }).click();
  await expect(page.getByRole("heading", { name: "收藏", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近使用", exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "搜索工具" })).toBeVisible();
  await page.getByRole("dialog").getByLabel("搜索工具").fill("resize");
  await page.getByRole("dialog").getByRole("button", { name: /调整图片尺寸/ }).click();
  await expect(page).toHaveURL(/\/tools\/image\/resize$/);
});
