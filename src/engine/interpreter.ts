import type { Block, Direction, ExecutionFocus, Level, Point, Program, RunState } from '../types';
import { ProgramError, validateProgram } from './validation';

export const EXECUTION_BUDGET = 2000;
export const pointKey = (point: Point) => `${point.x},${point.y}`;
const directions: Direction[] = ['N', 'E', 'S', 'W'];
const vectors = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;
type Atom = { type: 'forward' | 'backward' | 'left' | 'right'; focus: ExecutionFocus };

export function initialState(level: Level): RunState {
  return {
    robot: { ...level.start },
    collected: [],
    trail: [{ x: level.start.x, y: level.start.y }],
    actions: 0,
    status: 'idle',
    message: '准备好了吗？给 Brclio 排一条路线吧。',
    focus: null,
    budgetUsed: 0,
  };
}

/** The interpreter has no React, DOM, timers or animation dependencies. */
export class Interpreter {
  state: RunState;
  private iterator?: Generator<Atom>;
  private pending?: IteratorResult<Atom>;
  private program?: Program;
  private used = 0;
  private obstacles: Set<string>;
  private required: Set<string>;
  constructor(
    private level: Level,
    input: unknown,
    private budget = EXECUTION_BUDGET,
  ) {
    this.state = initialState(level);
    this.obstacles = new Set(level.obstacles.map(pointKey));
    this.required = new Set(level.stars.map(pointKey));
    try {
      this.program = validateProgram(input, level);
      this.iterator = this.walk(this.program.main, [], []);
      this.pending = this.iterator.next();
      this.state.status = 'paused';
      this.state.message = '一步一步，看看机器人会走到哪里。';
    } catch (error) {
      this.error(error);
    }
  }
  private spend(id: string) {
    if (++this.used > this.budget)
      throw new ProgramError(
        `这次程序有点长，超过了 ${this.budget} 次执行预算。减少一些重复次数再试试吧。`,
        id,
      );
  }
  private *walk(
    nodes: Block[],
    loops: ExecutionFocus['loops'],
    calls: ExecutionFocus['calls'],
  ): Generator<Atom> {
    for (const node of nodes) {
      this.spend(node.id); // Every instruction dispatch, including control structures.
      if (node.type === 'repeat') {
        for (let iteration = 1; iteration <= node.times; iteration++) {
          this.spend(node.id); // Loop iteration is an interpreter transition too.
          yield* this.walk(
            node.body,
            [...loops, { id: node.id, iteration, total: node.times }],
            calls,
          );
        }
      } else if (node.type === 'call') {
        yield* this.walk(this.program!.functions[node.function], loops, [
          ...calls,
          { id: node.id, function: node.function },
        ]);
      } else {
        const total = 'steps' in node ? node.steps : 1;
        for (let step = 1; step <= total; step++) {
          this.spend(node.id);
          yield { type: node.type, focus: { blockId: node.id, step, total, loops, calls } };
        }
      }
    }
  }
  private error(error: unknown) {
    const e =
      error instanceof ProgramError
        ? error
        : new ProgramError('这段程序暂时无法执行，请检查积木后重试。');
    this.state = {
      ...this.state,
      status: 'error',
      message: e.message,
      budgetUsed: this.used,
      focus: e.blockId
        ? {
            ...(this.state.focus ?? { step: 1, total: 1, loops: [], calls: [] }),
            blockId: e.blockId,
          }
        : this.state.focus,
    };
    this.iterator = undefined;
    this.pending = undefined;
  }
  private finish() {
    if (this.level.freePlay) {
      this.state.status = 'complete';
      this.state.message = '程序执行完成！继续试试你的新点子吧。';
    } else if (this.state.collected.length !== this.required.size) {
      this.state.status = 'incomplete';
      this.state.message = `还差 ${this.required.size - this.state.collected.length} 颗星星。看看哪些格子还没走到？`;
    } else if (!this.level.goal || pointKey(this.state.robot) !== pointKey(this.level.goal)) {
      this.state.status = 'incomplete';
      this.state.message = '积木执行完啦，不过 Brclio 还没停在旗子上。再检查一下路线吧。';
    } else {
      this.state.status = 'success';
      this.state.message = '任务完成！你的路线太棒啦。';
    }
  }
  /** Exactly one atomic action. Look ahead only to normalize control frames and detect EOF. */
  step(): RunState {
    if (this.state.status !== 'paused' || !this.pending || !this.iterator) return this.state;
    if (this.pending.done) {
      this.finish();
      return this.state;
    }
    const atom = this.pending.value;
    const robot = { ...this.state.robot };
    this.state = { ...this.state, focus: atom.focus };
    if (atom.type === 'left' || atom.type === 'right') {
      robot.direction =
        directions[(directions.indexOf(robot.direction) + (atom.type === 'right' ? 1 : 3)) % 4];
    } else {
      const [dx, dy] = vectors[robot.direction];
      const sign = atom.type === 'backward' ? -1 : 1;
      robot.x += dx * sign;
      robot.y += dy * sign;
      if (
        robot.x < 0 ||
        robot.x >= this.level.width ||
        robot.y < 0 ||
        robot.y >= this.level.height
      ) {
        this.error(
          new ProgramError('机器人走到地图外面啦，检查一下前进或后退的步数。', atom.focus.blockId),
        );
        return this.state;
      }
      if (this.obstacles.has(pointKey(robot))) {
        this.error(new ProgramError('前面有障碍物，试试先转个弯。', atom.focus.blockId));
        return this.state;
      }
    }
    const key = pointKey(robot);
    const moved = atom.type === 'forward' || atom.type === 'backward';
    const collected =
      moved && this.required.has(key) && !this.state.collected.includes(key)
        ? [...this.state.collected, key]
        : this.state.collected;
    this.state = {
      ...this.state,
      robot,
      collected,
      actions: this.state.actions + 1,
      trail:
        atom.type === 'left' || atom.type === 'right'
          ? this.state.trail
          : [...this.state.trail, { x: robot.x, y: robot.y }],
    };
    try {
      this.pending = this.iterator.next();
      this.state.budgetUsed = this.used;
      if (this.pending.done) this.finish();
    } catch (error) {
      this.error(error);
    }
    return this.state;
  }
}

export function runToEnd(level: Level, program: unknown, budget = EXECUTION_BUDGET): RunState {
  const machine = new Interpreter(level, program, budget);
  while (machine.state.status === 'paused') machine.step();
  return machine.state;
}
