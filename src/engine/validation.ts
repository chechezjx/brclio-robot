import type { Block, FunctionName, Level, Program } from '../types';

export const MAX_NODES = 250;
export const MAX_LOOP_DEPTH = 2;
export class ProgramError extends Error {
  constructor(
    message: string,
    public blockId?: string,
  ) {
    super(message);
    this.name = 'ProgramError';
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (message: string, id?: string): never => {
  throw new ProgramError(message, id);
};
const keys = (v: Record<string, unknown>, allowed: string[], id?: string) => {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    fail('文件里有不认识的内容，请使用 Brclio 导出的程序。', id);
};

/** Validate untrusted data before it enters the editor or interpreter. No coercion. */
export function validateProgram(
  input: unknown,
  level: Level,
  mode: 'draft' | 'import' | 'run' = 'run',
): Program {
  if (!record(input)) return fail('这不是有效的机器人程序。');
  keys(input, ['version', 'levelId', 'main', 'functions']);
  if (input.version !== 1) return fail('这个程序版本暂时不支持，请使用版本 1。');
  if (input.levelId !== level.id) return fail('这个程序属于另一个关卡，请先切换到对应关卡。');
  if (!record(input.functions)) return fail('动作组合格式不正确。');
  keys(input.functions, ['A', 'B']);
  let count = 0;
  const ids = new Set<string>();
  function walk(input: unknown, depth: number): Block[] {
    if (!Array.isArray(input)) return fail('积木需要按顺序放在列表里。');
    if (depth > MAX_LOOP_DEPTH) return fail('最多可以把重复积木套两层哦。');
    const result: Block[] = [];
    for (const item of input) {
      if (++count > MAX_NODES) return fail(`程序太长了，最多放 ${MAX_NODES} 块积木。`);
      if (!record(item)) return fail('有一块积木的格式不正确。');
      if (
        typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) ||
        ['main', 'A', 'B'].includes(item.id)
      )
        return fail('积木的编号缺失或格式不正确。');
      const id = item.id;
      if (ids.has(id)) return fail('有两块积木的编号重复了，请检查导入文件。', id);
      ids.add(id);
      if (!['forward', 'backward', 'left', 'right', 'repeat', 'call'].includes(String(item.type)))
        return fail('发现了不认识的指令积木。', id);
      if (!level.allowed.includes(item.type as Block['type']))
        return fail('这一关还不能使用这块积木，试试本关积木库里的指令。', id);
      switch (item.type) {
        case 'forward':
        case 'backward':
          keys(item, ['id', 'type', 'steps'], id);
          if (
            typeof item.steps !== 'number' ||
            !Number.isInteger(item.steps) ||
            item.steps < 1 ||
            item.steps > 9
          )
            return fail('前进和后退的步数需要是 1 到 9。', id);
          result.push({ id, type: item.type, steps: item.steps });
          break;
        case 'left':
        case 'right':
          keys(item, ['id', 'type'], id);
          result.push({ id, type: item.type });
          break;
        case 'repeat': {
          keys(item, ['id', 'type', 'times', 'body'], id);
          if (
            typeof item.times !== 'number' ||
            !Number.isInteger(item.times) ||
            item.times < 2 ||
            item.times > 9
          )
            return fail('重复次数需要是 2 到 9。', id);
          const body = walk(item.body, depth + 1);
          if (mode !== 'draft' && body.length === 0)
            return fail('重复积木还是空的，先放几块指令进去吧。', id);
          result.push({ id, type: 'repeat', times: item.times, body });
          break;
        }
        case 'call':
          keys(item, ['id', 'type', 'function'], id);
          if (item.function !== 'A' && item.function !== 'B')
            return fail('只能执行动作组合 A 或 B。', id);
          result.push({ id, type: 'call', function: item.function });
          break;
      }
    }
    return result;
  }
  const program: Program = {
    version: 1,
    levelId: level.id,
    main: walk(input.main, 0),
    functions: { A: walk(input.functions.A, 0), B: walk(input.functions.B, 0) },
  };
  if (mode !== 'draft') {
    if (mode === 'run' && program.main.length === 0)
      fail('先在编程板上放几块积木，再让机器人出发吧。');
    if (level.maxBlocks && count > level.maxBlocks)
      fail(`这一关最多使用 ${level.maxBlocks} 块积木。试试用重复或动作组合来整理路线。`);
    function references(nodes: Block[], stack: FunctionName[]) {
      for (const node of nodes) {
        if (node.type === 'repeat') references(node.body, stack);
        if (node.type === 'call') {
          if (program.functions[node.function].length === 0)
            fail(`动作组合 ${node.function} 还是空的，先给它放一些积木吧。`, node.id);
          if (stack.includes(node.function))
            fail('动作组合不能绕回来执行自己哦，请检查 A 和 B 的调用。', node.id);
          references(program.functions[node.function], [...stack, node.function]);
        }
      }
    }
    references(program.main, []);
    references(program.functions.A, ['A']);
    references(program.functions.B, ['B']);
  }
  return program;
}

export function countBlocks(program: Program): number {
  const count = (nodes: Block[]): number =>
    nodes.reduce((n, b) => n + 1 + (b.type === 'repeat' ? count(b.body) : 0), 0);
  return count(program.main) + count(program.functions.A) + count(program.functions.B);
}
