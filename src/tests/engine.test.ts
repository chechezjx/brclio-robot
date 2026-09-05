import { describe, expect, it } from 'vitest';
import type { Block, Level, Program } from '../types';
import { allLevels, freeLevel } from '../data/levels';
import { Interpreter, runToEnd } from '../engine/interpreter';
import { validateProgram } from '../engine/validation';

let seq = 0;
const f = (steps = 1): Block => ({ id: `test-${++seq}`, type: 'forward', steps });
const r = (): Block => ({ id: `test-${++seq}`, type: 'right' });
const l = (): Block => ({ id: `test-${++seq}`, type: 'left' });
const b = (steps = 1): Block => ({ id: `test-${++seq}`, type: 'backward', steps });
const loop = (times: number, body: Block[]): Block => ({
  id: `test-${++seq}`,
  type: 'repeat',
  times,
  body,
});
const call = (name: 'A' | 'B' = 'A'): Block => ({
  id: `test-${++seq}`,
  type: 'call',
  function: name,
});
const map = (patch: Partial<Level> = {}): Level => ({
  ...freeLevel,
  id: 'test',
  width: 5,
  height: 5,
  start: { x: 1, y: 3, direction: 'N' },
  obstacles: [],
  stars: [],
  ...patch,
});
const p = (main: Block[], A: Block[] = [], B: Block[] = []): Program => ({
  version: 1,
  levelId: 'test',
  main,
  functions: { A, B },
});

describe('用户验收：执行规则', () => {
  it('1 顺序与朝向：前进2，右转，前进1 → (2,1) 东', () => {
    expect(runToEnd(map(), p([f(2), r(), f()])).robot).toEqual({ x: 2, y: 1, direction: 'E' });
  });
  it('2 重复4次[前进2,右转]，12个动作回到起点', () => {
    const level = map({ start: { x: 1, y: 1, direction: 'E' } });
    const state = runToEnd(level, p([loop(4, [f(2), r()])]));
    expect(state.robot).toEqual(level.start);
    expect(state.actions).toBe(12);
    expect(state.status).toBe('complete');
  });
  it('3 多格逐格碰撞，不穿过障碍、不执行剩余指令', () => {
    const state = runToEnd(
      map({ start: { x: 1, y: 1, direction: 'E' }, obstacles: [{ x: 3, y: 1 }] }),
      p([f(3), r()]),
    );
    expect(state.robot).toEqual({ x: 2, y: 1, direction: 'E' });
    expect(state.actions).toBe(1);
    expect(state.status).toBe('error');
    expect(state.message).toContain('障碍物');
  });
  it('4 朝北后退增加 y 且朝向不变', () =>
    expect(runToEnd(map({ start: { x: 2, y: 2, direction: 'N' } }), p([b()])).robot).toEqual({
      x: 2,
      y: 3,
      direction: 'N',
    }));
  it('5 函数A四次回原位和原朝向', () => {
    const level = map({ start: { x: 2, y: 2, direction: 'N' } });
    const state = runToEnd(level, p([call(), call(), call(), call()], [f(), r()]));
    expect(state.robot).toEqual(level.start);
    expect(state.actions).toBe(8);
  });
  it('6 前进3格分3次单步且最后一次立即结束', () => {
    const machine = new Interpreter(map(), p([f(3)]));
    expect(machine.step().robot.y).toBe(2);
    expect(machine.state.status).toBe('paused');
    expect(machine.step().robot.y).toBe(1);
    expect(machine.state.focus?.step).toBe(2);
    expect(machine.step().robot.y).toBe(0);
    expect(machine.state.status).toBe('complete');
    expect(machine.step().actions).toBe(3);
  });
  it('函数内两层循环的最后一次单步也立即结束，并保留执行上下文', () => {
    const machine = new Interpreter(map(), p([call()], [loop(2, [loop(2, [r()])])]));
    machine.step();
    expect(machine.state.focus?.calls[0].function).toBe('A');
    expect(machine.state.focus?.loops).toHaveLength(2);
    machine.step();
    machine.step();
    expect(machine.state.status).toBe('paused');
    machine.step();
    expect(machine.state.status).toBe('complete');
  });
  it('函数定义不会自动执行', () => expect(runToEnd(map(), p([r()], [f(9)])).actions).toBe(1));
  it('左转右转原地旋转、边界撞击保留合法位置', () => {
    expect(runToEnd(map(), p([l()])).robot).toEqual({ x: 1, y: 3, direction: 'W' });
    const state = runToEnd(map(), p([f(9)]));
    expect(state.robot.y).toBe(0);
    expect(state.actions).toBe(3);
    expect(state.status).toBe('error');
    expect(state.message).toContain('地图外');
  });
  it('进入星星自动收集，重复经过不重复计数，原地转向不收集', () => {
    const level = map({ stars: [{ x: 1, y: 2 }] });
    const original = structuredClone(level);
    const state = runToEnd(level, p([f(), b(), f()]));
    expect(state.collected).toEqual(['1,2']);
    expect(level).toEqual(original);
    expect(runToEnd(map({ stars: [{ x: 1, y: 3 }] }), p([r()])).collected).toEqual([]);
  });
  it('每次运行创建独立机器人与收集状态', () => {
    const level = map({ stars: [{ x: 1, y: 2 }] });
    const program = p([f()]);
    const a = runToEnd(level, program),
      b = runToEnd(level, program);
    expect(a).toEqual(b);
    expect(a.robot).not.toBe(b.robot);
    expect(a.collected).not.toBe(b.collected);
  });
});
describe('用户验收9：结束时判定通关', () => {
  it('末尾到终点且收集全部才成功', () =>
    expect(
      runToEnd(map({ freePlay: false, goal: { x: 1, y: 1 }, stars: [{ x: 1, y: 2 }] }), p([f(2)]))
        .status,
    ).toBe('success'));
  it('缺少星星不能成功', () =>
    expect(
      runToEnd(map({ freePlay: false, goal: { x: 1, y: 1 }, stars: [{ x: 2, y: 2 }] }), p([f(2)]))
        .status,
    ).toBe('incomplete'));
  it('不在终点不能成功', () =>
    expect(runToEnd(map({ freePlay: false, goal: { x: 3, y: 1 } }), p([f(2)])).status).toBe(
      'incomplete',
    ));
  it('经过终点后离开不能成功', () =>
    expect(runToEnd(map({ freePlay: false, goal: { x: 1, y: 2 } }), p([f(2)])).status).toBe(
      'incomplete',
    ));
  it('经过终点后撞墙不能成功', () =>
    expect(runToEnd(map({ freePlay: false, goal: { x: 1, y: 2 } }), p([f(9)])).status).toBe(
      'error',
    ));
  it('自由练习无需终点和全部星星', () =>
    expect(runToEnd(map({ stars: [{ x: 4, y: 4 }] }), p([r()])).status).toBe('complete'));
});
describe('用户验收10：异常与预算', () => {
  it.each([
    ['空程序', p([])],
    ['非法参数', p([f(0)])],
    ['未定义函数', p([call()])],
    ['空循环', p([loop(2, [])])],
    ['直接递归', p([call()], [call()])],
    ['间接递归', p([call()], [call('B')], [call()])],
  ])('%s返回友好的错误', (_, program) => {
    const state = runToEnd(map(), program);
    expect(state.status).toBe('error');
    expect(state.message.length).toBeGreaterThan(5);
  });
  it('未调用的函数体中的递归也拒绝', () =>
    expect(runToEnd(map(), p([r()], [call()])).status).toBe('error'));
  it('统一预算包含函数与循环控制结构', () => {
    const state = runToEnd(map(), p([call()], [loop(2, [r()])]), 5);
    expect(state.status).toBe('error');
    expect(state.message).toContain('预算');
    expect(state.actions).toBe(1);
    expect(state.budgetUsed).toBeGreaterThan(state.actions);
  });
  it('超2000预算有限结束而不会卡死', () => {
    const state = runToEnd(map(), p([loop(9, [call()])], [loop(9, [loop(9, [r()])])]));
    expect(state.status).toBe('error');
    expect(state.budgetUsed).toBe(2001);
    expect(state.actions).toBeLessThan(2000);
  });
  it('运行时快照不受外部程序编辑影响', () => {
    const program = p([f(3)]);
    const machine = new Interpreter(map(), program);
    (program.main[0] as Extract<Block, { type: 'forward' | 'backward' }>).steps = 1;
    machine.step();
    machine.step();
    machine.step();
    expect(machine.state.actions).toBe(3);
  });
  it('隐藏在函数体中的禁用指令与块数限制仍被校验', () => {
    expect(() => validateProgram(p([f()], [r()]), map({ allowed: ['forward'] }))).toThrow('这一关');
    expect(() => validateProgram(p([f(), f()]), map({ maxBlocks: 1 }))).toThrow('最多使用');
  });
});
describe('所有原创参考解共用学生解释器', () => {
  it.each(allLevels.map((level) => [level.id, level] as const))('%s真实可完成', (_, level) => {
    const state = runToEnd(level, level.solution);
    expect(state.status, state.message).toBe(level.freePlay ? 'complete' : 'success');
    expect(level.width).toBeGreaterThanOrEqual(4);
    expect(level.width).toBeLessThanOrEqual(12);
  });
});
