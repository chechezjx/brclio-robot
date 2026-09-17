import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { levels } from '../src/data/levels';
import { freshData, STORAGE_KEY } from '../src/storage/local';
import { runToEnd } from '../src/engine/interpreter';
import { programToPython } from '../src/features/editor/python';
import type { Level, Program } from '../src/types';

const pythonLevel = levels.find((level) => level.id === 'level-13')!;
const solutionCode = 'for _ in range(3):\n    robot.forward(3)\n    robot.turn_left()';
const levelNumber = (number: number) => levels.find((level) => level.number === number)!;
const levelButton = (page: Page, level: Level) =>
  page.getByRole('button', { name: `第${level.number}关 ${level.title}`, exact: true });

const readDraft = (page: Page, levelId: string) =>
  page.evaluate(
    ({ key, levelId }) => JSON.parse(localStorage.getItem(key)!).drafts[levelId] as Program,
    { key: STORAGE_KEY, levelId },
  );

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  let start = await source.boundingBox();
  let end = await target.boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  // Keep both ends away from the viewport edges, where dragging scrolls the page.
  // Otherwise a captured target coordinate can point at a different container by mouseup.
  const midpoint = (start!.y + start!.height / 2 + end!.y + end!.height / 2) / 2;
  await page.evaluate(
    (offset) => window.scrollBy({ top: offset, behavior: 'instant' }),
    midpoint - page.viewportSize()!.height / 2,
  );
  start = await source.boundingBox();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.move(start!.x + start!.width / 2 + 12, start!.y + start!.height / 2, {
    steps: 3,
  });
  end = await target.boundingBox();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 20 });
  await expect(target).toHaveClass(/drop-active/);
  await page.mouse.up();
}

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
  await expect(dialog).toContainText(`已完成 0 / ${levels.length} 关`);
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
  await page.getByRole('button', { name: '去下一关探险', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(levelNumber(14).title);
  await levelButton(page, pythonLevel).click();
  await page.reload();
  expect(await page.getByTestId('python-preview').textContent()).toBe(solutionCode);
  await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', '4');
  await expect(page.getByRole('button', { name: '第13关 Python 初探', exact: true })).toHaveClass(
    /done/,
  );
  await expect(page.locator('.progress-stat')).toHaveText(`1/ ${levels.length}`);
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

for (const number of [14, 15, 16, 17, 18]) {
  test(`第${number}关通过真实播放器收集全部星星并到达终点`, async ({ page }) => {
    const level = levelNumber(number);
    const expected = runToEnd(level, level.solution);
    await page.clock.install();
    await seedProgram(page, level.solution);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(level.title);
    expect(await page.getByTestId('python-preview').textContent()).toBe(
      programToPython(level.solution),
    );
    if (number === 18) {
      await page.screenshot({ path: 'test-results/python-capstone-desktop.png', fullPage: true });
      await page.locator('.function-definitions').screenshot({
        path: 'test-results/python-capstone-functions-desktop.png',
      });
      await page.locator('.python-preview').screenshot({
        path: 'test-results/python-capstone-preview-desktop.png',
      });
    }
    await page.getByRole('button', { name: '2倍速度', exact: true }).click();
    if (number >= 17) {
      await page.getByRole('button', { name: '单步', exact: true }).click();
      await expect(page.locator('.function-panel.function-executing')).toHaveCount(1);
      await expect(page.locator('.function-panel.function-executing h3')).toContainText(
        'def action_a():',
      );
      await expect(page.locator('.program-block.block-call.context-active')).toHaveCount(1);
      await expect(page.locator('.program-block.executing')).toHaveCount(1);
      await expect(
        page.getByRole('button', { name: '添加action_a()', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: '继续', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '运行程序', exact: true }).click();
    }
    await page.clock.runFor((expected.actions + 1) * 300);
    await expect(page.getByTestId('execution-status')).toHaveAttribute('data-status', 'success');
    await expect(page.getByTestId('action-count')).toHaveText(String(expected.actions));
    await expect(page.locator('.stars-count')).toHaveText(
      `${level.stars.length} / ${level.stars.length}`,
    );
    await expect(page.getByTestId('robot-map')).toHaveAttribute('data-x', String(level.goal!.x));
    await expect(page.getByTestId('robot-map')).toHaveAttribute('data-y', String(level.goal!.y));
    await expect(levelButton(page, level)).toHaveClass(/done/);
    if (number === 18) {
      await page.getByRole('button', { name: '进入自由实验室', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('自由实验室');
    } else {
      await page.getByRole('button', { name: '去下一关探险', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        levelNumber(number + 1).title,
      );
    }
  });
}

test('Python 函数可分别编辑、调用和撤销，预览保留定义与缩进', async ({ page }) => {
  await page.goto('/');
  await levelButton(page, levelNumber(17)).click();
  await expect(page.getByRole('heading', { name: /def action_a\(\):/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /def action_b\(\):/ })).toBeVisible();
  await page.getByRole('button', { name: '在函数 action_a()末尾插入', exact: true }).click();
  await page.getByRole('button', { name: '添加robot.forward(1)', exact: true }).click();
  await page.locator('.function-panel').first().getByLabel('第1块步数').selectOption('2');
  await page.getByRole('button', { name: '添加robot.turn_right()', exact: true }).click();
  await page.getByRole('button', { name: '在函数 action_b()末尾插入', exact: true }).click();
  await page.getByRole('button', { name: '添加robot.turn_left()', exact: true }).click();
  await page.getByRole('button', { name: '在主程序末尾插入', exact: true }).click();
  await drag(
    page,
    page.getByRole('button', { name: '添加action_a()', exact: true }),
    page.getByTestId('drop-main'),
  );
  await expect(
    page.locator('.board-paper').getByRole('button', { name: '选择第1块action_a()', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '添加action_b()', exact: true }).click();
  const preview =
    'def action_a():\n    robot.forward(2)\n    robot.turn_right()\n\n' +
    'def action_b():\n    robot.turn_left()\n\naction_a()\naction_b()';
  expect(await page.getByTestId('python-preview').textContent()).toBe(preview);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await readDraft(page, 'level-17')).main).toHaveLength(1);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  expect(await page.getByTestId('python-preview').textContent()).toBe(preview);
  await page.reload();
  expect(await page.getByTestId('python-preview').textContent()).toBe(preview);
});

test('六个 Python 关卡保留独立草稿，最终关函数与双层循环备份可往返', async ({ page }) => {
  await seedProgram(page, pythonLevel.solution);
  for (const number of [14, 15, 16, 17, 18]) {
    const level = levelNumber(number);
    await levelButton(page, level).click();
    await page.getByLabel('导入程序文件').setInputFiles({
      name: `${level.id}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(level.solution)),
    });
    expect(await page.getByTestId('python-preview').textContent()).toBe(
      programToPython(level.solution),
    );
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出程序', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Brclio-level-18-.*\.json$/);
  await page.getByRole('button', { name: '清空程序', exact: true }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.getByTestId('program-block')).toHaveCount(0);
  await page.getByLabel('导入程序文件').setInputFiles((await download.path())!);
  await page.reload();
  for (const number of [13, 14, 15, 16, 17, 18]) {
    const level = levelNumber(number);
    await levelButton(page, level).click();
    expect(await readDraft(page, level.id)).toEqual(level.solution);
    expect(await page.getByTestId('python-preview').textContent()).toBe(
      programToPython(level.solution),
    );
  }
});

test('十八关导航在笔记本与窄屏无溢出，刷新后选中关卡保持可见', async ({ page }) => {
  const capstone = levelNumber(18);
  await seedProgram(page, capstone.solution);
  for (const width of [1440, 1024, 640, 601]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    await expect(levelButton(page, capstone)).toHaveAttribute('aria-current', 'step');
    const selected = await levelButton(page, capstone).boundingBox();
    const track = await page.locator('.level-track').boundingBox();
    expect(selected!.x).toBeGreaterThanOrEqual(track!.x);
    expect(selected!.x + selected!.width).toBeLessThanOrEqual(track!.x + track!.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(await readDraft(page, capstone.id)).toEqual(capstone.solution);
  }
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

  test('综合关双层循环和两组函数在手机可查看、编辑且没有横向溢出', async ({ page }) => {
    const capstone = levelNumber(18);
    await seedProgram(page, capstone.solution);
    await page.getByRole('tab', { name: /我的编程板/ }).tap();
    await expect(page.getByRole('heading', { name: /def action_a\(\):/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /def action_b\(\):/ })).toBeVisible();
    expect(await page.getByTestId('python-preview').textContent()).toBe(
      programToPython(capstone.solution),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/python-capstone-mobile.png', fullPage: true });
    await page.locator('.function-definitions').screenshot({
      path: 'test-results/python-capstone-functions-mobile.png',
    });
    await page.locator('.python-preview').screenshot({
      path: 'test-results/python-capstone-preview-mobile.png',
    });
    await page.getByRole('button', { name: '在函数 action_b()末尾插入', exact: true }).tap();
    await expect(page.locator('.selection-toolbar')).toContainText('函数 action_b()');
    await page.getByRole('tab', { name: '机器人地图', exact: true }).tap();
    await expect(page.getByTestId('robot-map')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
