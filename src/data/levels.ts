import type { Block, InstructionType, Level, Program } from '../types';

// These helpers only create program data. Reference solutions use the same interpreter as children.
let sequence = 0;
const id = () => `ref-${++sequence}`;
const f = (steps = 1): Block => ({ id: id(), type: 'forward', steps });
const b = (steps = 1): Block => ({ id: id(), type: 'backward', steps });
const r = (): Block => ({ id: id(), type: 'right' });
const l = (): Block => ({ id: id(), type: 'left' });
const repeat = (times: number, body: Block[]): Block => ({ id: id(), type: 'repeat', times, body });
const call = (name: 'A' | 'B' = 'A'): Block => ({ id: id(), type: 'call', function: name });
const movement: InstructionType[] = ['forward', 'backward', 'left', 'right'];
const loopCommands: InstructionType[] = [...movement, 'repeat'];
const all: InstructionType[] = [...loopCommands, 'call'];
type Definition = Omit<Level, 'solution' | 'id'> & { main: Block[]; A?: Block[]; B?: Block[] };
function level(data: Definition): Level {
  const { main, A = [], B = [], ...rest } = data;
  const levelId = data.freePlay ? 'free' : `level-${data.number}`;
  const solution: Program = { version: 1, levelId, main, functions: { A, B } };
  return { ...rest, id: levelId, solution };
}

export const levels: Level[] = [
  level({
    number: 1,
    title: '向星星出发',
    chapter: '初次见面',
    story: 'Brclio 的第一次探险！沿着星星小路，去和小旗子打个招呼吧。',
    concept: '顺序与前进',
    width: 5,
    height: 5,
    start: { x: 1, y: 4, direction: 'N' },
    goal: { x: 1, y: 1 },
    obstacles: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 3 },
    ],
    stars: [
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ],
    allowed: ['forward'],
    hints: [
      '机器人头顶的小箭头，就是它前进的方向。',
      '数一数：从 Brclio 到旗子，一共要走几格？',
      '放入一个前进积木，把数字改成 3。',
    ],
    main: [f(3)],
  }),
  level({
    number: 2,
    title: '长长的星光路',
    chapter: '初次见面',
    story: '星星排成了一队。给前进积木换一个数字，看看会发生什么。',
    concept: '步数参数',
    width: 6,
    height: 5,
    start: { x: 0, y: 2, direction: 'E' },
    goal: { x: 5, y: 2 },
    obstacles: [
      { x: 2, y: 0 },
      { x: 4, y: 4 },
    ],
    stars: [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
    allowed: ['forward'],
    hints: [
      'Brclio 这次面朝右边。',
      '前进积木上的数字表示要走几格。',
      '把前进的步数设为 5，就能停在旗子上。',
    ],
    main: [f(5)],
  }),
  level({
    number: 3,
    title: '积木接力赛',
    chapter: '初次见面',
    story: '让积木接力传递指令，Brclio 会按照你排列的顺序出发。',
    concept: '顺序执行',
    width: 5,
    height: 7,
    start: { x: 2, y: 6, direction: 'N' },
    goal: { x: 2, y: 0 },
    obstacles: [
      { x: 0, y: 2 },
      { x: 4, y: 4 },
    ],
    stars: [
      { x: 2, y: 4 },
      { x: 2, y: 2 },
    ],
    allowed: ['forward'],
    hints: [
      '下一块积木会接着上一块的终点执行。',
      '把长路线拆成两段试试。',
      '前进 3 格，再前进 3 格。一个前进 6 格也可以！',
    ],
    main: [f(3), f(3)],
  }),
  level({
    number: 4,
    title: '转角遇见你',
    chapter: '转弯的秘密',
    story: '旗子躲到了转角后面。学会右转，就能找到它！',
    concept: '右转与朝向',
    width: 5,
    height: 5,
    start: { x: 1, y: 4, direction: 'N' },
    goal: { x: 4, y: 1 },
    obstacles: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ],
    stars: [
      { x: 1, y: 2 },
      { x: 3, y: 1 },
    ],
    allowed: movement,
    hints: ['右转只转身，不会向前走。', '先向上走，再向右走。', '前进 3 格 → 右转 → 前进 3 格。'],
    main: [f(3), r(), f(3)],
  }),
  level({
    number: 5,
    title: '小石头，借过啦',
    chapter: '转弯的秘密',
    story: '石头挡住了直路。仔细观察，绕个小弯就能继续前进。',
    concept: '绕过障碍',
    width: 6,
    height: 6,
    start: { x: 1, y: 4, direction: 'E' },
    goal: { x: 4, y: 4 },
    obstacles: [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ],
    stars: [
      { x: 1, y: 2 },
      { x: 4, y: 2 },
    ],
    allowed: movement,
    hints: [
      '前面不能直接通过，看看石头上方的空地。',
      '先左转向上，再沿石头上方绕过去。',
      '左转 → 前进 2 → 右转 → 前进 3 → 右转 → 前进 2。',
    ],
    main: [l(), f(2), r(), f(3), r(), f(2)],
  }),
  level({
    number: 6,
    title: '倒退也有好点子',
    chapter: '转弯的秘密',
    story: '背后也有一颗星星！不用转身，先后退再去旗子那里。',
    concept: '后退不改变朝向',
    width: 5,
    height: 6,
    start: { x: 2, y: 3, direction: 'N' },
    goal: { x: 4, y: 1 },
    obstacles: [
      { x: 1, y: 2 },
      { x: 3, y: 3 },
    ],
    stars: [
      { x: 2, y: 4 },
      { x: 2, y: 1 },
    ],
    allowed: movement,
    hints: [
      '后退会让 Brclio 往背后的格子走，但脸朝的方向不变。',
      '先收集背后的星星，再向前走。',
      '后退 1 → 前进 3 → 右转 → 前进 2。',
    ],
    main: [b(), f(3), r(), f(2)],
  }),
  level({
    number: 7,
    title: '星星楼梯',
    chapter: '重复的魔法',
    story: '一段小楼梯，一段小楼梯……把一样的路线装进重复积木吧。',
    concept: '第一次使用循环',
    width: 6,
    height: 6,
    start: { x: 0, y: 5, direction: 'N' },
    goal: { x: 3, y: 2 },
    obstacles: [
      { x: 4, y: 4 },
      { x: 1, y: 1 },
      { x: 5, y: 1 },
    ],
    stars: [
      { x: 1, y: 4 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ],
    allowed: loopCommands,
    maxBlocks: 5,
    hints: [
      '每一段楼梯都先向上，再向右。',
      '把「前进、右转、前进、左转」放到重复积木里面。',
      '重复 3 次［前进 1 → 右转 → 前进 1 → 左转］。',
    ],
    main: [repeat(3, [f(), r(), f(), l()])],
  }),
  level({
    number: 8,
    title: '绕花园一圈',
    chapter: '重复的魔法',
    story: '四边的星星在等你。绕着花园走一圈，最后回到出发的旗子上。',
    concept: '循环中的方向变化',
    width: 6,
    height: 6,
    start: { x: 1, y: 1, direction: 'E' },
    goal: { x: 1, y: 1 },
    obstacles: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
    stars: [
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ],
    allowed: loopCommands,
    maxBlocks: 3,
    hints: [
      '每一条边一样长，每次转角的方向也一样。',
      '重复积木里只需要两块积木。',
      '重复 4 次［前进 3 → 右转］。',
    ],
    main: [repeat(4, [f(3), r()])],
  }),
  level({
    number: 9,
    title: '双层魔法盒',
    chapter: '重复的魔法',
    story: '大魔法盒里还能放小魔法盒。试着用两层重复，绕过中央的小花园。',
    concept: '两层嵌套循环',
    width: 7,
    height: 7,
    start: { x: 1, y: 1, direction: 'E' },
    goal: { x: 1, y: 1 },
    obstacles: [
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ],
    stars: [
      { x: 5, y: 1 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
    ],
    allowed: loopCommands,
    maxBlocks: 4,
    hints: [
      '外层重复管四条边，内层重复管每条边上的小步。',
      '把一个重复积木拖进另一个重复积木。',
      '重复 4 次［重复 2 次［前进 2］→ 右转］。',
    ],
    main: [repeat(4, [repeat(2, [f(2)]), r()])],
  }),
  level({
    number: 10,
    title: '你好，动作组合 A',
    chapter: '我的动作组合',
    story: '给一小段路线起个名字吧。以后只要执行 A，就能再次走出这段路线。',
    concept: '定义与调用函数',
    width: 6,
    height: 6,
    start: { x: 1, y: 1, direction: 'E' },
    goal: { x: 1, y: 1 },
    obstacles: [
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ],
    stars: [
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ],
    allowed: all,
    maxBlocks: 6,
    hints: [
      '在动作组合 A 里放入「前进 3 → 右转」。',
      '动作组合不会自己执行，要把「执行 A」放到主程序里。',
      '在主程序依次放 4 块「执行 A」。',
    ],
    A: [f(3), r()],
    main: [call(), call(), call(), call()],
  }),
  level({
    number: 11,
    title: 'A 和 B 的合作',
    chapter: '我的动作组合',
    story: '一个组合负责向上，一个组合负责向右。让两个小伙伴合作登上星星台阶。',
    concept: '复用两个函数',
    width: 7,
    height: 7,
    start: { x: 0, y: 6, direction: 'N' },
    goal: { x: 4, y: 2 },
    obstacles: [
      { x: 3, y: 5 },
      { x: 5, y: 3 },
      { x: 1, y: 1 },
    ],
    stars: [
      { x: 0, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ],
    allowed: all,
    maxBlocks: 8,
    hints: [
      '把「向前走再右转」放进 A，「向前走再左转」放进 B。',
      '先执行 A 再执行 B，就完成了一段楼梯。',
      'A：前进 2 → 右转。B：前进 2 → 左转。主程序：A → B → A → B。',
    ],
    A: [f(2), r()],
    B: [f(2), l()],
    main: [call(), call('B'), call(), call('B')],
  }),
  level({
    number: 12,
    title: '星际路线设计师',
    chapter: '我的动作组合',
    story: '最后一场星际探险！把循环和动作组合搭配起来，设计自己的星光路线。',
    concept: '循环与函数协作',
    width: 8,
    height: 8,
    start: { x: 0, y: 7, direction: 'N' },
    goal: { x: 6, y: 1 },
    obstacles: [
      { x: 4, y: 5 },
      { x: 6, y: 3 },
      { x: 1, y: 2 },
      { x: 5, y: 0 },
    ],
    stars: [
      { x: 2, y: 5 },
      { x: 4, y: 3 },
      { x: 6, y: 1 },
    ],
    allowed: all,
    maxBlocks: 7,
    hints: [
      '每段楼梯的形状相同，只是位置不同。',
      '在 A 里定义一个小台阶，主程序用重复来执行 A。',
      'A：前进 2 → 右转 → 前进 2 → 左转。主程序：重复 3 次［执行 A］。',
    ],
    A: [f(2), r(), f(2), l()],
    main: [repeat(3, [call()])],
  }),
];

export const freeLevel = level({
  number: 0,
  title: '自由实验室',
  chapter: '自由练习',
  story: '这里没有固定答案。试试新的路线，编一个只属于你的机器人小故事。',
  concept: '自由探索',
  width: 8,
  height: 8,
  start: { x: 3, y: 4, direction: 'N' },
  obstacles: [
    { x: 1, y: 1 },
    { x: 6, y: 6 },
  ],
  stars: [
    { x: 3, y: 2 },
    { x: 5, y: 4 },
    { x: 1, y: 5 },
  ],
  allowed: all,
  hints: [
    '所有积木都可以使用。',
    '试试让 Brclio 画一个正方形，再回到起点。',
    '没有强制通关目标，正常走完程序就完成啦。',
  ],
  freePlay: true,
  main: [repeat(4, [f(2), r()])],
});
export const allLevels = [...levels, freeLevel];
export const getLevel = (id: string) => allLevels.find((level) => level.id === id) ?? levels[0];
