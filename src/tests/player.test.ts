import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeLevel } from '../data/levels';
import { Player } from '../engine/player';
import type { Level, Program, RunState } from '../types';
const level: Level = {
  ...freeLevel,
  id: 'test',
  start: { x: 1, y: 4, direction: 'N' },
  obstacles: [],
  stars: [],
};
const program: Program = {
  version: 1,
  levelId: 'test',
  main: [{ id: 'f', type: 'forward', steps: 3 }],
  functions: { A: [], B: [] },
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe('用户验收7、8：串行播放和取消', () => {
  it('暂停后不推进，继续从原位置执行，不重复动作', () => {
    const player = new Player(level, () => {});
    player.run(program);
    vi.advanceTimersByTime(600);
    expect(player.state.actions).toBe(1);
    player.pause();
    vi.advanceTimersByTime(6000);
    expect(player.state.actions).toBe(1);
    expect(player.state.status).toBe('paused');
    player.resume();
    vi.advanceTimersByTime(600);
    expect(player.state.actions).toBe(2);
    vi.advanceTimersByTime(600);
    expect(player.state.actions).toBe(3);
    expect(player.state.status).toBe('complete');
  });
  it('重复点击运行不会创建并发任务', () => {
    const player = new Player(level, () => {});
    player.run(program);
    player.run(program);
    player.run(program);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(600);
    expect(player.state.actions).toBe(1);
  });
  it('运行中重置清除旧任务并保留程序供下一次运行', () => {
    const player = new Player(level, () => {});
    player.run(program);
    vi.advanceTimersByTime(600);
    player.reset();
    vi.runAllTimers();
    expect(player.state.robot).toEqual(level.start);
    expect(player.state.actions).toBe(0);
    player.run(program);
    vi.runAllTimers();
    expect(player.state.actions).toBe(3);
  });
  it('运行中切关不会让旧任务改变新关卡', () => {
    const player = new Player(level, () => {});
    player.run(program);
    vi.advanceTimersByTime(600);
    const next = { ...level, start: { x: 6, y: 6, direction: 'E' as const } };
    player.reset(next);
    vi.runAllTimers();
    expect(player.state.robot).toEqual(next.start);
    expect(player.state.status).toBe('idle');
  });
  it('dispose后不发布状态，旧回调即使被强制执行也无效', () => {
    const output: RunState[] = [];
    let callback: (() => void) | undefined;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce((fn) => {
      callback = fn as () => void;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const player = new Player(level, (s) => output.push(s));
    player.run(program);
    player.reset();
    const length = output.length;
    callback?.();
    expect(output).toHaveLength(length);
    expect(player.state.actions).toBe(0);
    player.dispose();
    callback?.();
    expect(output).toHaveLength(length);
    spy.mockRestore();
  });
  it('暂停状态单步只执行一个原子动作', () => {
    const player = new Player(level, () => {});
    player.run(program);
    player.pause();
    player.step(program);
    expect(player.state.actions).toBe(1);
    vi.runAllTimers();
    expect(player.state.actions).toBe(1);
  });
  it.each([0.5, 1, 2] as const)('%s倍速度不改变结果', (speed) => {
    const player = new Player(level, () => {});
    player.setSpeed(speed);
    player.run(program);
    vi.runAllTimers();
    expect(player.state.robot).toEqual({ x: 1, y: 1, direction: 'N' });
    expect(player.state.actions).toBe(3);
    expect(player.state.status).toBe('complete');
  });
  it('第二次运行从初始状态出发', () => {
    const player = new Player(level, () => {});
    player.run(program);
    vi.runAllTimers();
    player.run(program);
    expect(player.state.robot).toEqual(level.start);
    expect(player.state.actions).toBe(0);
    vi.runAllTimers();
    expect(player.state.actions).toBe(3);
  });
});
