import { describe, expect, it } from 'vitest';
import { levels } from '../data/levels';
import { countBlocks } from '../engine/validation';
import { exportProgram, freshData, importProgram, readLocal, writeLocal } from '../storage/local';
import type { Point } from '../types';

const pointKey = ({ x, y }: Point) => `${x},${y}`;

describe('新增 Python 关卡的数据与存档兼容', () => {
  it.each([14, 15, 16, 17, 18])('第%d关地图坐标有效，障碍不会覆盖机器人、终点或星星', (number) => {
    const level = levels.find((entry) => entry.number === number)!;
    expect(level).toBeDefined();
    expect(level.syntax).toBe('python');
    expect(level.goal).toBeDefined();
    const points = [level.start, level.goal!, ...level.stars, ...level.obstacles];
    for (const point of points) {
      expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(level.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThan(level.height);
    }
    const obstacles = new Set(level.obstacles.map(pointKey));
    expect(obstacles.size).toBe(level.obstacles.length);
    expect(new Set(level.stars.map(pointKey)).size).toBe(level.stars.length);
    for (const point of [level.start, level.goal!, ...level.stars]) {
      expect(obstacles.has(pointKey(point))).toBe(false);
    }
  });

  it('旧关卡与六个 Python 关卡的草稿、通关记录和函数备份可同时恢复', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const data = freshData();
    data.currentLevel = 'level-18';
    data.settings.speed = 2;
    const savedLevels = levels.filter((level) => level.number === 12 || level.number >= 13);
    for (const level of savedLevels) {
      data.drafts[level.id] = importProgram(exportProgram(level.solution), level.id);
      data.completed[level.id] = {
        levelId: level.id,
        blocks: countBlocks(level.solution),
        completedAt: '2026-09-17T10:00:00.000Z',
      };
    }
    expect(Object.keys(data.drafts)).toHaveLength(7);
    expect(writeLocal(storage, data)).toBeUndefined();
    const restored = readLocal(storage);
    expect(restored.warning).toBeUndefined();
    expect(restored.data).toEqual(data);
    for (const level of savedLevels) {
      expect(restored.data.drafts[level.id]).toEqual(level.solution);
    }
  });
});
