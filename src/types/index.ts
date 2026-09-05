export type Direction = 'N' | 'E' | 'S' | 'W';
export type Point = { x: number; y: number };
export type Robot = Point & { direction: Direction };
export type FunctionName = 'A' | 'B';
export type InstructionType = 'forward' | 'backward' | 'left' | 'right' | 'repeat' | 'call';
export type Block =
  | { id: string; type: 'forward' | 'backward'; steps: number }
  | { id: string; type: 'left' | 'right' }
  | { id: string; type: 'repeat'; times: number; body: Block[] }
  | { id: string; type: 'call'; function: FunctionName };
export interface Program {
  version: 1;
  levelId: string;
  main: Block[];
  functions: Record<FunctionName, Block[]>;
}
export interface Level {
  id: string;
  number: number;
  title: string;
  story: string;
  concept: string;
  chapter: string;
  width: number;
  height: number;
  start: Robot;
  goal?: Point;
  obstacles: Point[];
  stars: Point[];
  allowed: InstructionType[];
  hints: string[];
  solution: Program;
  maxBlocks?: number;
  freePlay?: boolean;
}
export interface ExecutionFocus {
  blockId: string;
  step: number;
  total: number;
  loops: { id: string; iteration: number; total: number }[];
  calls: { id: string; function: FunctionName }[];
}
export type RunStatus =
  'idle' | 'running' | 'paused' | 'success' | 'complete' | 'incomplete' | 'error';
export interface RunState {
  robot: Robot;
  collected: string[];
  trail: Point[];
  actions: number;
  status: RunStatus;
  message: string;
  focus: ExecutionFocus | null;
  budgetUsed: number;
}
export interface Settings {
  sound: boolean;
  speed: 0.5 | 1 | 2;
  trail: boolean;
  reducedMotion: boolean;
}
export interface Completion {
  levelId: string;
  blocks: number;
  completedAt: string;
}
export interface SavedData {
  version: 1;
  currentLevel: string;
  drafts: Record<string, Program>;
  completed: Record<string, Completion>;
  settings: Settings;
}
export interface EditorHistory {
  past: Program[];
  present: Program;
  future: Program[];
}
export type ContainerId = 'main' | 'A' | 'B' | string;
