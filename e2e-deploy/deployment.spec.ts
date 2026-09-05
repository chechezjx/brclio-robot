import { test, expect } from '@playwright/test';

test('生产产物可加载、运行、刷新，并从当前部署路径加载所有素材', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (/\.(js|css)(\?|$)/.test(response.url())) assets.push(response.url());
  });
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: '向星星出发' })).toBeVisible();
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  const iconURL = new URL(icon!, page.url());
  const iconResponse = await page.request.get(iconURL.href);
  expect(iconResponse.status()).toBe(200);
  expect(await iconResponse.text()).toContain('<svg');
  expect(iconURL.href.startsWith(baseURL!)).toBe(true);
  expect(assets.length).toBeGreaterThanOrEqual(2);
  expect(assets.every((url) => url.startsWith(baseURL!))).toBe(true);
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  await page.getByLabel('第1块步数').selectOption('3');
  await page.getByRole('button', { name: '2倍速度', exact: true }).click();
  await page.getByRole('button', { name: '运行程序', exact: true }).click();
  await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success');
  await page.reload();
  await expect(page.getByLabel('第1块步数')).toHaveValue('3');
  expect(errors).toEqual([]);
});
