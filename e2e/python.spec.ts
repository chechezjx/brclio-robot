import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { levels } from '../src/data/levels';
import { freshData, STORAGE_KEY } from '../src/storage/local';
import type { Program } from '../src/types';

const pythonLevel = levels.find((level) => level.id === 'level-13')!;
const solutionCode = 'for _ in range(3):\n    robot.forward(3)\n    robot.turn_left()';

async function openPython(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '第13关 Python 初探', exact: true }).click();
}

async function buildPythonSolution(page: Page) {
  await page.getByRole('button', { name: '添加for _ in range(2):', exact: true }).click();
  await page.getByLabel('第1块重复次数').selectOption('3');
  await page.getByRole('button', { name: '添加到里面', exact: true }).click();
  await page.getByRole('button', { name: '添加robot.forward(1)', exact: true }).click();
  await page.getByLabel('第1.1块步数').selectOption('3');
  await page.getByRole('button', { name: '添加robot.turn_left()', exact: true }).click();
}

async function seedProgram(page: Page, program: Program) {
  await page.goto('/');
  const data = freshData();
  data.currentLevel = program.levelId;
  data.drafts[program.levelId] = program;
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORAGE_KEY,
    data,
  });
  await page.reload();
}

test('Python 关卡可从选择器进入，旧关卡仍使用中文积木', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('已完成 0 / 13 关');
  await expect(dialog.getByRole('heading', { name: /Python 启蒙/ })).toBeVisible();
  await dialog.getByRole('button', { name: /13 Python 初探/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Python 初探');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const statement of [
    'robot.forward(1)',
    'robot.backward(1)',
    'robot.turn_left()',
    'robot.turn_right()',
    'for _ in range(2):',
  ]) {
    await expect(page.getByRole('button', { name: `添加${statement}`, exact: true })).toBeEnabled();
  }
  await expect(page.getByTestId('python-preview')).toContainText('添加积木');
  await page.getByRole('button', { name: '第1关 向星星出发', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加前进', exact: true })).toBeEnabled();
  await expect(page.getByTestId('python-preview')).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: '第13关 Python 初探', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Python 初探');
});

test('Python 积木预览、撤销重做、循环单步、通关与刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openPython(page);
  await page.getByRole('button', { name: '添加for _ in range(2):', exact: true }).click();
  expect(await page.getByTestId('python-preview').textContent()).toBe(
    'for _ in range(2):\n    pass',
  );
  await page.getByLabel('第1块重复次数').selectOption('3');
  await page.getByRole('button', { name: '添加到里面', exact: true }).click();
  await page.getByRole('button', { name: '添加robot.forward(1)', exact: true }).click();
  await page.getByLabel('第1.1块步数').selectOption('3');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('第1.1块步数')).toHaveValue('1');
  expect(await page.getByTestId('python-preview').textContent()).toBe(
    'for _ in range(3):\n    robot.forward(1)',
  );
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByLabel('第1.1块步数')).toHaveValue('3');
  await page.getByRole('button', { name: '添加robot.turn_left()', exact: true }).click();
  expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
  await page.screenshot({ path: 'test-results/python-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '单步', exact: true }).click();
  const mapBounds = await page.getByTestId('robot-map').boundingBox();
  expect(mapBounds).not.toBeNull();
  expect(mapBounds!.y).toBeGreaterThanOrEqual(0);
  expect(mapBounds!.y + mapBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-x', '2');
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '4');
  await expect(page.locator('.program-block.executing .block-handle')).toHaveAttribute(
    'aria-label',
    '选择第1.1块robot.forward(3)',
  );
  await expect(
    page.locator('.program-block.context-active > .block-top .block-handle'),
  ).toHaveAttribute('aria-label', '选择第1块for _ in range(3):');
  await expect(
    page.getByRole('button', { name: '添加robot.forward(1)', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('第1块重复次数')).toBeDisabled();
  await expect(page.getByLabel('第1.1块步数')).toBeDisabled();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导入程序', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '2倍速度', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success');
  await expect(page.getByTestId('action-count')).toHaveText('12');
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-x', '1');
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '1');
  await expect(page.getByRole('button', { name: '进入自由实验室', exact: true })).toBeVisible();
  await page.reload();
  expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '4');
  await expect(page.getByRole('button', { name: '第13关 Python 初探', exact: true })).toHaveClass(
    /done/,
  );
  await expect(page.locator('.progress-stat')).toHaveText('1/ 13');
  expect(errors).toEqual([]);
});

test('第12关通关继续 Python 关卡，JSON 备份往返保留循环与参数', async ({ page }) => {
  await seedProgram(page, levels.find((level) => level.id === 'level-12')!.solution);
  await page.getByRole('button', { name: '2倍速度', exact: true }).click();
  await page.getByRole('button', { name: '运行程序', exact: true }).click();
  await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success', {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: '去下一关探险', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Python 初探');
  await page.getByLabel('导入程序文件').setInputFiles({
    name: 'python-solution.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pythonLevel.solution)),
  });
  await expect(page.getByTestId('program-block')).toHaveCount(3);
  expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出程序', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Brclio-level-13-.*\.json$/);
  await page.getByRole('button', { name: '清空程序', exact: true }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(0);
  await page.getByLabel('导入程序文件').setInputFiles((await download.path())!);
  await expect(page.getByLabel('第1块重复次数')).toHaveValue('3');
  await expect(page.getByLabel('第1.1块步数')).toHaveValue('3');
  expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
});

test.describe('Python 手机布局', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 844 } });
  test('长指令与循环在窄屏可操作，页面没有横向溢出', async ({ page }) => {
    await openPython(page);
    await page.getByRole('tab', { name: /我的编程板/ }).tap();
    await buildPythonSolution(page);
    await expect(
      page.getByRole('button', { name: '选择第1.1块robot.forward(3)', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '选择第1.2块robot.turn_left()', exact: true }),
    ).toBeVisible();
    expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/python-mobile.png', fullPage: true });
    await page.getByRole('tab', { name: '机器人地图', exact: true }).tap();
    await expect(page.getByTestId('robot-map')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
