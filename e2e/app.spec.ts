import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { levels } from '../src/data/levels';
import { freshData, STORAGE_KEY } from '../src/storage/local';
import type { Program } from '../src/types';

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const start = await source.boundingBox(),
    end = await target.boundingBox();
  if (!start || !end) throw new Error('Drag targets are not visible');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
async function seed(page: Page, program: Program) {
  const data = freshData();
  data.currentLevel = program.levelId;
  data.drafts[program.levelId] = program;
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY,
    data,
  });
  await page.goto('/');
}
const readDraft = (page: Page) =>
  page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    return saved.drafts[saved.currentLevel] as Program;
  }, STORAGE_KEY);

test('完整闭环：点击添加、参数、三次单步、通关、刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '向星星出发' })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-workspace.png', fullPage: true });
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  await page.getByLabel('第1块步数').selectOption('3');
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '3');
  await expect(page.getByRole('button', { name: '添加前进', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '2');
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success');
  await expect(page.getByTestId('action-count')).toHaveText('3');
  await page.reload();
  await expect(page.getByLabel('第1块步数')).toHaveValue('3');
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '4');
  expect(errors).toEqual([]);
});

test('鼠标从积木库拖入与插入调序', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '第4关 转角遇见你', exact: true }).click();
  await drag(
    page,
    page.getByRole('button', { name: '添加前进', exact: true }),
    page.getByTestId('drop-main'),
  );
  await expect(page.getByTestId('program-block')).toHaveCount(1);
  await page.getByRole('button', { name: '添加右转', exact: true }).click();
  await drag(
    page,
    page.getByRole('button', { name: '选择第2块右转', exact: true }),
    page.getByRole('button', { name: '选择第1块前进', exact: true }),
  );
  await expect
    .poll(async () => (await readDraft(page)).main.map((b) => b.type))
    .toEqual(['right', 'forward']);
});

test('非拖拽编辑：插入、复制、删除、键盘调序、撤销重做、清空确认', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '第4关 转角遇见你', exact: true }).click();
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  await page.getByRole('button', { name: '添加右转', exact: true }).click();
  const first = page.getByRole('button', { name: '选择第1块前进', exact: true });
  await first.click();
  await first.press('Alt+ArrowRight');
  await expect
    .poll(async () => (await readDraft(page)).main.map((b) => b.type))
    .toEqual(['right', 'forward']);
  await page.getByRole('button', { name: '复制积木', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(3);
  await page.getByRole('button', { name: '删除积木', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(2);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(3);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(2);
  await page.getByRole('button', { name: '清空程序', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '再想想', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(2);
  await page.getByRole('button', { name: '清空程序', exact: true }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(2);
});

test('循环容器支持点击插入、移回主程序、鼠标拖入', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '第7关 星星楼梯', exact: true }).click();
  await page.getByRole('button', { name: '添加重复', exact: true }).click();
  await page.getByRole('button', { name: '添加到里面', exact: true }).click();
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  await expect(page.getByLabel('第1.1块步数')).toBeVisible();
  await page.getByLabel('移动到程序区域').selectOption('main');
  await expect(page.getByLabel('第2块步数')).toBeVisible();
  const loopId = (await readDraft(page)).main[0].id;
  await drag(
    page,
    page.getByRole('button', { name: '添加右转', exact: true }),
    page.getByTestId(`drop-${loopId}`),
  );
  await expect(page.getByRole('button', { name: '选择第1.1块右转', exact: true })).toBeVisible();
});

test('函数内逐格执行、双位置高亮、暂停继续、编辑锁和切关取消', async ({ page }) => {
  await seed(page, levels[9].solution);
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await expect(page.locator('.program-block.context-active')).toHaveCount(1);
  await expect(page.locator('.program-block.executing')).toHaveCount(1);
  await expect(page.getByTestId('action-count')).toHaveText('1');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const actions = await page.getByTestId('action-count').innerText();
  await page.waitForTimeout(800);
  await expect(page.getByTestId('action-count')).toHaveText(actions);
  await expect(page.getByRole('button', { name: '导入程序', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByTestId('action-count').innerText()))
    .toBeGreaterThan(Number(actions));
  await page.getByRole('button', { name: '第2关 长长的星光路', exact: true }).click();
  await page.waitForTimeout(900);
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-x', '0');
  await expect(page.getByTestId('action-count')).toHaveText('0');
});

test('导入与导出备份、无效导入不覆盖现有程序', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  await page
    .getByLabel('导入程序文件')
    .setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{broken'),
    });
  await expect(page.getByRole('alert')).toContainText('原来的程序');
  await expect(page.getByTestId('program-block')).toHaveCount(1);
  await page
    .getByLabel('导入程序文件')
    .setInputFiles({
      name: 'solution.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(levels[0].solution)),
    });
  await expect(page.getByLabel('第1块步数')).toHaveValue('3');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出程序', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Brclio-level-1-.*\.json$/);
  const downloaded = await download.path();
  await page.getByLabel('导入程序文件').setInputFiles(downloaded!);
  await expect(page.getByLabel('第1块步数')).toHaveValue('3');
});

test('损坏存档与存储禁用都不会白屏', async ({ page, context }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('读取');
  await expect(page.getByRole('button', { name: '添加前进', exact: true })).toBeEnabled();
  const blocked = await context.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Blocked');
      },
    });
  });
  await blocked.goto('/');
  await blocked.getByRole('button', { name: '添加前进', exact: true }).click();
  await expect(blocked.getByTestId('program-block')).toHaveCount(1);
  await expect(blocked.getByRole('alert')).toBeVisible();
  await blocked.close();
});

test('异步导入遇到切走再切回或运行重置时被取消', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加前进', exact: true }).click();
  const draft = await readDraft(page);
  await page.evaluate(() => {
    Object.defineProperty(File.prototype, 'text', {
      value() {
        return new Promise<string>((resolve) => {
          (window as unknown as { resolveImport: (s: string) => void }).resolveImport = resolve;
        });
      },
      configurable: true,
    });
  });
  await page
    .getByLabel('导入程序文件')
    .setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.getByRole('button', { name: '第2关 长长的星光路', exact: true }).click();
  await page.getByRole('button', { name: '第1关 向星星出发', exact: true }).click();
  await page.evaluate(
    (text) => (window as unknown as { resolveImport: (s: string) => void }).resolveImport(text),
    JSON.stringify(levels[0].solution),
  );
  await expect(page.getByRole('alert')).toContainText('旧导入已取消');
  expect(await readDraft(page)).toEqual(draft);
  await page
    .getByLabel('导入程序文件')
    .setInputFiles({
      name: 'slow-again.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
  await page.getByRole('button', { name: '运行程序', exact: true }).click();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.evaluate(
    (text) => (window as unknown as { resolveImport: (s: string) => void }).resolveImport(text),
    JSON.stringify(levels[0].solution),
  );
  await expect(page.getByRole('alert')).toContainText('旧导入已取消');
  expect(await readDraft(page)).toEqual(draft);
});

test('不同宽度换行不改变顺序，减少动画仍保留朝向', async ({ page }) => {
  await seed(page, levels[10].solution);
  const before = await readDraft(page);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    if (width === 390) await page.getByRole('tab', { name: /我的编程板/ }).click();
    expect(await readDraft(page)).toEqual(before);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: 'test-results/mobile-functions.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '单步', exact: true }).click();
  await page.getByRole('tab', { name: '机器人地图', exact: true }).click();
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-direction', 'N');
  await page.screenshot({ path: 'test-results/mobile-map.png', fullPage: true });
});

test.describe('平板触屏编辑', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });
  test('触屏点击与真实 touch 事件拖放', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '添加前进', exact: true }).tap();
    await expect(page.getByTestId('program-block')).toHaveCount(1);
    await page.getByRole('button', { name: '删除积木', exact: true }).tap();
    await expect(page.getByTestId('program-block')).toHaveCount(0);
    const source = page.getByRole('button', { name: '添加前进', exact: true }),
      target = page.getByTestId('drop-main');
    await target.scrollIntoViewIfNeeded();
    const s = await source.boundingBox(),
      t = await target.boundingBox();
    if (!s || !t) throw new Error('missing target');
    const cdp = await context.newCDPSession(page);
    const x = s.x + s.width / 2,
      y = s.y + s.height / 2,
      tx = t.x + t.width / 2,
      ty = t.y + t.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.waitForTimeout(350);
    for (let i = 1; i <= 15; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + ((tx - x) * i) / 15, y: y + ((ty - y) * i) / 15, id: 1 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('program-block')).toHaveCount(1);
    await cdp.detach();
    await page.screenshot({ path: 'test-results/tablet-workspace.png', fullPage: true });
  });
});

test.describe('手机触屏完整闭环', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('在地图和编程板之间切换，点击编程并运行', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('robot-map')).toBeVisible();
    await page.getByRole('tab', { name: /我的编程板/ }).tap();
    await page.getByRole('button', { name: '添加前进', exact: true }).tap();
    await page.getByLabel('第1块步数').selectOption('3');
    await page.getByRole('button', { name: '2倍速度', exact: true }).tap();
    await page.getByRole('button', { name: '运行程序', exact: true }).tap();
    await page.getByRole('tab', { name: '机器人地图', exact: true }).tap();
    await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '1');
    await page.getByRole('tab', { name: /我的编程板/ }).tap();
    await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success');
    await page.getByRole('tab', { name: '机器人地图', exact: true }).tap();
    await page.getByRole('button', { name: '重置', exact: true }).tap();
    await page.getByRole('button', { name: '单步', exact: true }).tap();
    await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '3');
    await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible();
  });
});

test('常见笔记本尺寸首屏可看到运行按钮', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const run = await page.getByRole('button', { name: '运行程序', exact: true }).boundingBox();
  expect(run!.y + run!.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'test-results/laptop-workspace.png', fullPage: true });
});
