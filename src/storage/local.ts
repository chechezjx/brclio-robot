import type { Program, SavedData, Settings } from '../types';
import { allLevels, getLevel } from '../data/levels';
import { validateProgram } from '../engine/validation';

export const STORAGE_KEY = 'brclio-robot:v1';
export const defaultSettings: Settings = {
  sound: false,
  speed: 1,
  trail: true,
  reducedMotion: false,
};
export const freshData = (): SavedData => ({
  version: 1,
  currentLevel: 'level-1',
  drafts: {},
  completed: {},
  settings: { ...defaultSettings },
});
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export function readLocal(storage: StoragePort): { data: SavedData; warning?: string } {
  const data = freshData();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data };
    const parsed: unknown = JSON.parse(raw);
    if (
      !object(parsed) ||
      parsed.version !== 1 ||
      !object(parsed.drafts) ||
      !object(parsed.settings) ||
      !object(parsed.completed)
    )
      throw new Error('corrupt');
    let damaged = false;
    if (
      typeof parsed.currentLevel === 'string' &&
      allLevels.some((l) => l.id === parsed.currentLevel)
    )
      data.currentLevel = parsed.currentLevel;
    for (const level of allLevels) {
      if (parsed.drafts[level.id] !== undefined) {
        try {
          data.drafts[level.id] = validateProgram(parsed.drafts[level.id], level, 'draft');
        } catch {
          damaged = true;
        }
      }
      const completed = parsed.completed[level.id];
      if (
        object(completed) &&
        completed.levelId === level.id &&
        typeof completed.blocks === 'number' &&
        Number.isInteger(completed.blocks) &&
        completed.blocks >= 0 &&
        completed.blocks <= 250 &&
        typeof completed.completedAt === 'string' &&
        !Number.isNaN(Date.parse(completed.completedAt))
      ) {
        data.completed[level.id] = {
          levelId: level.id,
          blocks: completed.blocks,
          completedAt: completed.completedAt,
        };
      }
    }
    const s = parsed.settings;
    data.settings = {
      sound: typeof s.sound === 'boolean' ? s.sound : false,
      trail: typeof s.trail === 'boolean' ? s.trail : true,
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : false,
      speed: s.speed === 0.5 || s.speed === 2 ? s.speed : 1,
    };
    return {
      data,
      warning: damaged ? '有一份本地草稿损坏了，已保留其他有效草稿。可以导入备份继续。' : undefined,
    };
  } catch {
    return {
      data,
      warning: '暂时无法读取本地进度，可能是存档损坏或浏览器限制。你仍然可以编程，并通过导出备份。',
    };
  }
}
export function writeLocal(storage: StoragePort, data: SavedData): string | undefined {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return;
  } catch {
    return '本次更改未能保存到浏览器。请导出程序备份，避免关闭页面后丢失。';
  }
}
export function importProgram(text: string, currentLevelId: string): Program {
  if (text.length > 256_000) throw new Error('文件太大了，请选择小于 256 KB 的程序文件。');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('这个 JSON 文件没读懂。原来的程序还在，请换一份有效的备份。');
  }
  return validateProgram(data, getLevel(currentLevelId), 'import');
}
export const exportProgram = (program: Program) => JSON.stringify(program, null, 2);
export function downloadProgram(program: Program) {
  const blob = new Blob([exportProgram(program)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Brclio-${program.levelId}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
