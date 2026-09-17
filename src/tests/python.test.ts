import { describe, expect, it } from 'vitest';
import { emptyProgram } from '../features/editor/model';
import { programToPython, pythonStatement } from '../features/editor/python';
import type { Block } from '../types';

describe('Python 积木语法', () => {
  it.each<[Block, string]>([
    [{ id: 'f', type: 'forward', steps: 12 }, 'robot.forward(12)'],
    [{ id: 'b', type: 'backward', steps: 3 }, 'robot.backward(3)'],
    [{ id: 'l', type: 'left' }, 'robot.turn_left()'],
    [{ id: 'r', type: 'right' }, 'robot.turn_right()'],
    [{ id: 'loop', type: 'repeat', times: 10, body: [] }, 'for _ in range(10):'],
    [{ id: 'a', type: 'call', function: 'A' }, 'action_a()'],
    [{ id: 'b-call', type: 'call', function: 'B' }, 'action_b()'],
  ])('将 %j 显示为完整语句', (block, statement) => {
    expect(pythonStatement(block)).toBe(statement);
  });

  it('嵌套循环使用四空格缩进并保持指令顺序', () => {
    const program = emptyProgram('python');
    program.main = [
      {
        id: 'outer',
        type: 'repeat',
        times: 2,
        body: [
          { id: 'forward', type: 'forward', steps: 3 },
          {
            id: 'inner',
            type: 'repeat',
            times: 4,
            body: [{ id: 'right', type: 'right' }],
          },
          { id: 'backward', type: 'backward', steps: 1 },
        ],
      },
      { id: 'left', type: 'left' },
    ];
    expect(programToPython(program)).toBe(
      [
        'for _ in range(2):',
        '    robot.forward(3)',
        '    for _ in range(4):',
        '        robot.turn_right()',
        '    robot.backward(1)',
        'robot.turn_left()',
      ].join('\n'),
    );
  });

  it('函数定义放在主程序之前，并补齐嵌套调用的空函数', () => {
    const program = emptyProgram('python');
    program.main = [{ id: 'call-a', type: 'call', function: 'A' }];
    program.functions.A = [
      {
        id: 'loop',
        type: 'repeat',
        times: 2,
        body: [{ id: 'call-b', type: 'call', function: 'B' }],
      },
    ];
    expect(programToPython(program)).toBe(
      [
        'def action_a():',
        '    for _ in range(2):',
        '        action_b()',
        '',
        'def action_b():',
        '    pass',
        '',
        'action_a()',
      ].join('\n'),
    );
  });

  it('保留尚未调用的非空函数，忽略未使用的空函数', () => {
    const program = emptyProgram('python');
    program.functions.B = [{ id: 'forward', type: 'forward', steps: 2 }];
    expect(programToPython(program)).toBe('def action_b():\n    robot.forward(2)');
  });

  it('空循环使用 pass，空程序不生成额外代码', () => {
    const program = emptyProgram('python');
    expect(programToPython(program)).toBe('');
    program.main = [{ id: 'loop', type: 'repeat', times: 3, body: [] }];
    expect(programToPython(program)).toBe('for _ in range(3):\n    pass');
  });

  it('实时保留修改后的完整数字，不修改输入程序', () => {
    const program = emptyProgram('python');
    const move: Block = { id: 'move', type: 'forward', steps: 3 };
    const loop: Block = { id: 'loop', type: 'repeat', times: 2, body: [move] };
    program.main = [loop];
    const before = structuredClone(program);
    expect(programToPython(program)).toBe('for _ in range(2):\n    robot.forward(3)');
    expect(program).toEqual(before);

    move.steps = 123;
    loop.times = 45;
    const updated = structuredClone(program);
    expect(programToPython(program)).toBe('for _ in range(45):\n    robot.forward(123)');
    expect(program).toEqual(updated);
  });
});
