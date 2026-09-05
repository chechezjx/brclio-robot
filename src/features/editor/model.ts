import type { Block, ContainerId, EditorHistory, FunctionName, Program } from '../../types';
import { MAX_NODES } from '../../engine/validation';

export const newId = () => `b-${crypto.randomUUID()}`;
export const emptyProgram = (levelId: string): Program => ({
  version: 1,
  levelId,
  main: [],
  functions: { A: [], B: [] },
});
export function newBlock(type: Block['type'], name: FunctionName = 'A'): Block {
  const id = newId();
  if (type === 'repeat') return { id, type, times: 2, body: [] };
  if (type === 'call') return { id, type, function: name };
  if (type === 'forward' || type === 'backward') return { id, type, steps: 1 };
  return { id, type };
}
export function findBlock(
  program: Program,
  id: string,
): { block: Block; list: Block[]; index: number; container: ContainerId } | undefined {
  const find = (list: Block[], container: ContainerId): ReturnType<typeof findBlock> => {
    for (let index = 0; index < list.length; index++) {
      const block = list[index];
      if (block.id === id) return { block, list, index, container };
      if (block.type === 'repeat') {
        const child = find(block.body, block.id);
        if (child) return child;
      }
    }
  };
  return (
    find(program.main, 'main') ?? find(program.functions.A, 'A') ?? find(program.functions.B, 'B')
  );
}
export function getContainer(program: Program, id: ContainerId): Block[] | undefined {
  if (id === 'main') return program.main;
  if (id === 'A' || id === 'B') return program.functions[id];
  const result = findBlock(program, id);
  return result?.block.type === 'repeat' ? result.block.body : undefined;
}
export function cloneBlock(block: Block): Block {
  return block.type === 'repeat'
    ? { ...block, id: newId(), body: block.body.map(cloneBlock) }
    : { ...block, id: newId() };
}
export function assertEditorLimits(program: Program) {
  let count = 0;
  const walk = (nodes: Block[], depth: number) => {
    if (depth > 2) throw new Error('最多可以把重复积木套两层哦。');
    for (const node of nodes) {
      if (++count > MAX_NODES) throw new Error(`最多可以放 ${MAX_NODES} 块积木。`);
      if (node.type === 'repeat') walk(node.body, depth + 1);
    }
  };
  walk(program.main, 0);
  walk(program.functions.A, 0);
  walk(program.functions.B, 0);
}
export function insertBlock(
  program: Program,
  block: Block,
  container: ContainerId,
  index?: number,
): Program {
  const next = structuredClone(program);
  const list = getContainer(next, container);
  if (!list) throw new Error('先选一个有效的插入位置吧。');
  list.splice(index ?? list.length, 0, block);
  assertEditorLimits(next);
  return next;
}
export function removeBlock(program: Program, id: string): Program {
  const next = structuredClone(program);
  const found = findBlock(next, id);
  if (found) found.list.splice(found.index, 1);
  return next;
}
export function moveBlock(
  program: Program,
  id: string,
  container: ContainerId,
  index?: number,
): Program {
  const next = structuredClone(program);
  const found = findBlock(next, id);
  if (!found) return program;
  const target = getContainer(next, container);
  if (!target) return program;
  if (container === id || (found.block.type === 'repeat' && contains(found.block.body, container)))
    throw new Error('不能把积木放进自己的肚子里哦。');
  let at = index ?? target.length;
  if (found.list === target && found.index < at) at--;
  found.list.splice(found.index, 1);
  target.splice(at, 0, found.block);
  assertEditorLimits(next);
  return next;
}
function contains(nodes: Block[], id: string): boolean {
  return nodes.some((b) => b.id === id || (b.type === 'repeat' && contains(b.body, id)));
}
export function changeNumber(program: Program, id: string, value: number): Program {
  const next = structuredClone(program);
  const found = findBlock(next, id);
  if (!found) return program;
  if ('steps' in found.block) found.block.steps = Math.min(9, Math.max(1, value));
  if (found.block.type === 'repeat') found.block.times = Math.min(9, Math.max(2, value));
  return next;
}
export const historyFor = (program: Program): EditorHistory => ({
  past: [],
  present: program,
  future: [],
});
export function editHistory(history: EditorHistory, program: Program): EditorHistory {
  if (JSON.stringify(history.present) === JSON.stringify(program)) return history;
  return { past: [...history.past.slice(-49), history.present], present: program, future: [] };
}
export function undoHistory(history: EditorHistory): EditorHistory {
  const previous = history.past.at(-1);
  return previous
    ? {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      }
    : history;
}
export function redoHistory(history: EditorHistory): EditorHistory {
  const next = history.future[0];
  return next
    ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) }
    : history;
}
