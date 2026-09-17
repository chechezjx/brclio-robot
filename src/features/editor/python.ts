import type { Block, FunctionName, Program } from '../../types';

const functionIdentifier = (name: FunctionName) => `action_${name.toLowerCase()}`;

export function pythonStatement(block: Block): string {
  switch (block.type) {
    case 'forward':
    case 'backward':
      return `robot.${block.type}(${block.steps})`;
    case 'left':
    case 'right':
      return `robot.turn_${block.type}()`;
    case 'repeat':
      return `for _ in range(${block.times}):`;
    case 'call':
      return `${functionIdentifier(block.function)}()`;
  }
}

export function programToPython(program: Program): string {
  const called = new Set<FunctionName>();
  const collectCalls = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === 'call') called.add(block.function);
      if (block.type === 'repeat') collectCalls(block.body);
    }
  };
  collectCalls(program.main);
  collectCalls(program.functions.A);
  collectCalls(program.functions.B);

  const render = (blocks: Block[], depth: number): string => {
    const indent = '    '.repeat(depth);
    if (blocks.length === 0) return `${indent}pass`;
    return blocks
      .map((block) => {
        const statement = `${indent}${pythonStatement(block)}`;
        return block.type === 'repeat'
          ? `${statement}\n${render(block.body, depth + 1)}`
          : statement;
      })
      .join('\n');
  };

  const sections: string[] = [];
  for (const name of ['A', 'B'] as const) {
    const body = program.functions[name];
    if (body.length > 0 || called.has(name)) {
      sections.push(`def ${functionIdentifier(name)}():\n${render(body, 1)}`);
    }
  }
  if (program.main.length > 0) sections.push(render(program.main, 0));
  return sections.join('\n\n');
}
