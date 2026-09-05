import { describe, expect, it } from 'vitest';
import { freeLevel, levels } from '../data/levels';
import {
  exportProgram,
  freshData,
  importProgram,
  readLocal,
  STORAGE_KEY,
  writeLocal,
} from '../storage/local';
import { runToEnd } from '../engine/interpreter';
import { validateProgram } from '../engine/validation';
import {
  cloneBlock,
  editHistory,
  emptyProgram,
  historyFor,
  insertBlock,
  moveBlock,
  newBlock,
  redoHistory,
  removeBlock,
  undoHistory,
} from '../features/editor/model';
import type { Block } from '../types';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
describe('用户验收11：本地保存与导入', () => {
  it('刷新恢复当前关卡和各自独立草稿、进度与设置', () => {
    const storage = memory(),
      data = freshData();
    data.currentLevel = 'level-2';
    data.drafts = { 'level-1': levels[0].solution, 'level-2': levels[1].solution };
    data.settings.speed = 2;
    data.completed['level-1'] = {
      levelId: 'level-1',
      blocks: 1,
      completedAt: new Date().toISOString(),
    };
    expect(writeLocal(storage, data)).toBeUndefined();
    expect(readLocal(storage).data).toEqual(data);
  });
  it('导出再导入语义不变', () => {
    const program = levels[11].solution;
    const imported = importProgram(exportProgram(program), 'level-12');
    expect(imported).toEqual(program);
    expect(runToEnd(levels[11], imported)).toEqual(runToEnd(levels[11], program));
  });
  it('损坏的JSON不覆盖有效草稿', () => {
    let current = levels[0].solution;
    try {
      current = importProgram('{broken', 'level-1');
    } catch {
      /* retain current */
    }
    expect(current).toEqual(levels[0].solution);
  });
  it('损坏本地数据或存储失败返回提示', () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, 'broken');
    expect(readLocal(storage).warning).toBeTruthy();
    const unavailable = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readLocal(unavailable).warning).toBeTruthy();
    expect(writeLocal(unavailable, freshData())).toContain('备份');
  });
  it('一份坏草稿不会导致其他有效草稿丢失', () => {
    const storage = memory();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...freshData(), drafts: { 'level-1': {}, 'level-2': levels[1].solution } }),
    );
    const loaded = readLocal(storage);
    expect(loaded.data.drafts['level-2']).toEqual(levels[1].solution);
    expect(loaded.warning).toBeTruthy();
  });
  it('跨关卡程序不能导入', () =>
    expect(() => importProgram(exportProgram(levels[1].solution), 'level-1')).toThrow(
      '另一个关卡',
    ));
  it.each([
    [
      '未知版本',
      (p: Record<string, unknown>) => {
        p.version = 2;
      },
    ],
    [
      '未知指令',
      (p: Record<string, unknown>) => {
        p.main = [{ id: 'a', type: 'eval', code: 'alert(1)' }];
      },
    ],
    [
      '数字字符串',
      (p: Record<string, unknown>) => {
        p.main = [{ id: 'a', type: 'forward', steps: '3' }];
      },
    ],
    [
      '重复ID',
      (p: Record<string, unknown>) => {
        p.main = [
          { id: 'a', type: 'forward', steps: 1 },
          { id: 'a', type: 'right' },
        ];
      },
    ],
    [
      '缺失ID',
      (p: Record<string, unknown>) => {
        p.main = [{ type: 'forward', steps: 1 }];
      },
    ],
    [
      '未知HTML',
      (p: Record<string, unknown>) => {
        p.html = '<script/>';
      },
    ],
    [
      '超节点',
      (p: Record<string, unknown>) => {
        p.main = Array.from({ length: 251 }, (_, i) => ({ id: `r${i}`, type: 'right' }));
      },
    ],
    [
      '超深度',
      (p: Record<string, unknown>) => {
        p.main = [
          {
            id: 'r1',
            type: 'repeat',
            times: 2,
            body: [
              {
                id: 'r2',
                type: 'repeat',
                times: 2,
                body: [{ id: 'r3', type: 'repeat', times: 2, body: [] }],
              },
            ],
          },
        ];
      },
    ],
  ])('%s被拒绝', (_, mutate) => {
    const program = structuredClone(freeLevel.solution) as unknown as Record<string, unknown>;
    mutate(program);
    expect(() => validateProgram(program, freeLevel, 'import')).toThrow();
  });
  it('不同函数间的ID也必须唯一', () => {
    const program = emptyProgram('free');
    program.main = [{ id: 'c', type: 'call', function: 'A' }];
    program.functions.A = [{ id: 'x', type: 'right' }];
    program.functions.B = [{ id: 'x', type: 'right' }];
    expect(() => validateProgram(program, freeLevel)).toThrow('重复');
  });
});
describe('编辑数据顺序，与DOM换行无关', () => {
  it('插入、跨容器移动、从循环回主程序保持稳定ID和紧凑数组', () => {
    const a = newBlock('forward'),
      repeat = newBlock('repeat');
    let program = insertBlock(emptyProgram('free'), a, 'main');
    program = insertBlock(program, repeat, 'main');
    program = moveBlock(program, a.id, repeat.id);
    expect(program.main).toHaveLength(1);
    expect((program.main[0] as Extract<Block, { type: 'repeat' }>).body[0].id).toBe(a.id);
    program = moveBlock(program, a.id, 'main', 0);
    expect(program.main.map((b) => b.id)).toEqual([a.id, repeat.id]);
  });
  it('同列表调序正确处理移除后的索引', () => {
    const a = newBlock('left'),
      b = newBlock('right'),
      c = newBlock('forward');
    const program = { ...emptyProgram('free'), main: [a, b, c] };
    expect(moveBlock(program, a.id, 'main', 2).main.map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    expect(moveBlock(program, c.id, 'main', 0).main.map((x) => x.id)).toEqual([c.id, a.id, b.id]);
  });
  it('复制递归更新所有ID，删除、撤销和重做恢复结构', () => {
    const a = newBlock('repeat');
    if (a.type === 'repeat') a.body = [newBlock('forward')];
    const copied = cloneBlock(a);
    expect(copied.id).not.toBe(a.id);
    if (copied.type === 'repeat' && a.type === 'repeat')
      expect(copied.body[0].id).not.toBe(a.body[0].id);
    const initial = insertBlock(emptyProgram('free'), a, 'main');
    const history = editHistory(historyFor(initial), removeBlock(initial, a.id));
    expect(history.present.main).toHaveLength(0);
    expect(undoHistory(history).present).toEqual(initial);
    expect(redoHistory(undoHistory(history)).present.main).toHaveLength(0);
  });
  it('不允许放入自己、自己的后代或形成第三层循环', () => {
    const a = newBlock('repeat'),
      b = newBlock('repeat'),
      c = newBlock('repeat');
    let program = insertBlock(emptyProgram('free'), a, 'main');
    program = insertBlock(program, b, a.id);
    program = insertBlock(program, c, 'main');
    expect(() => moveBlock(program, a.id, a.id)).toThrow();
    expect(() => moveBlock(program, a.id, b.id)).toThrow();
    expect(() => moveBlock(program, c.id, b.id)).toThrow('两层');
  });
});
