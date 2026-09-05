import { useState } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import {
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  Repeat2,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Plus,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Puzzle,
  ChevronRight,
} from 'lucide-react';
import type {
  Block,
  ContainerId,
  EditorHistory,
  ExecutionFocus,
  Level,
  Program,
} from '../../types';
import { countBlocks } from '../../engine/validation';
import {
  changeNumber,
  cloneBlock,
  findBlock,
  getContainer,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
} from './model';

export const blockLabels = {
  forward: '前进',
  backward: '后退',
  left: '左转',
  right: '右转',
  repeat: '重复',
  call: '执行',
};
export function BlockIcon({ type, name }: { type: Block['type']; name?: string }) {
  if (type === 'call') return <span className="function-symbol">{name ?? 'A'}</span>;
  const Icon = {
    forward: ArrowUp,
    backward: ArrowDown,
    left: CornerUpLeft,
    right: CornerUpRight,
    repeat: Repeat2,
  }[type];
  return <Icon size={25} strokeWidth={2.5} />;
}
function LibraryBlock({
  type,
  name,
  disabled,
  onAdd,
}: {
  type: Block['type'];
  name?: 'A' | 'B';
  disabled: boolean;
  onAdd: () => void;
}) {
  const { ref, isDragging } = useDraggable({
    id: `library-${type}-${name ?? ''}`,
    disabled,
    data: { kind: 'library', type, name },
  });
  return (
    <button
      ref={ref}
      className={`library-block block-${type} ${isDragging ? 'dragging' : ''}`}
      disabled={disabled}
      onClick={onAdd}
      aria-label={`添加${blockLabels[type]}${name ?? ''}`}
    >
      <span className="library-icon">
        <BlockIcon type={type} name={name} />
      </span>
      <span>
        {blockLabels[type]}
        {name && ` ${name}`}
      </span>
      {(type === 'forward' || type === 'backward' || type === 'repeat') && (
        <span className="library-number">{type === 'repeat' ? 2 : 1}</span>
      )}
    </button>
  );
}
interface ListProps {
  nodes: Block[];
  container: ContainerId;
  depth: number;
  prefix?: string;
  selected: string | null;
  targetContainer: ContainerId;
  focus: ExecutionFocus | null;
  locked: boolean;
  onSelect: (id: string) => void;
  onTarget: (id: ContainerId) => void;
  onNumber: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, delta: number) => void;
}
function InsertEnd({
  container,
  index,
  depth,
  locked,
  onTarget,
  empty,
}: {
  container: ContainerId;
  index: number;
  depth: number;
  locked: boolean;
  onTarget: () => void;
  empty: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `end-${container}`,
    disabled: locked,
    collisionPriority: depth + 1,
    data: { container, index },
  });
  return (
    <button
      ref={ref}
      disabled={locked}
      onClick={onTarget}
      className={`insert-end ${empty ? 'empty-target' : ''} ${isDropTarget ? 'drop-active' : ''}`}
      data-testid={`drop-${container}`}
      aria-label={`在${container === 'main' ? '主程序' : container === 'A' || container === 'B' ? `动作组合 ${container}` : '重复积木'}末尾插入`}
    >
      <Plus size={empty ? 30 : 22} />
      {empty && (
        <>
          <strong>{depth ? '把要重复的积木放进来' : '把你的第一个积木放在这里'}</strong>
          <span>{depth ? '点击这里，再从上面选择指令' : '点击或拖入上面的指令，拼出一条路线'}</span>
        </>
      )}
    </button>
  );
}
function BoardBlock({ node, index, ...props }: ListProps & { node: Block; index: number }) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: node.id,
    disabled: props.locked,
    data: { kind: 'node', id: node.id },
  });
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `before-${node.id}`,
    disabled: props.locked,
    collisionPriority: props.depth + 2,
    data: { container: props.container, index },
  });
  const active = props.focus?.blockId === node.id;
  const contextual =
    props.focus?.calls.some((c) => c.id === node.id) ||
    props.focus?.loops.some((l) => l.id === node.id);
  const number = props.prefix ? `${props.prefix}.${index + 1}` : `${index + 1}`;
  const loop = props.focus?.loops.find((l) => l.id === node.id);
  return (
    <div
      ref={dropRef}
      className={`block-wrap ${node.type === 'repeat' ? 'loop-wrap' : ''} ${isDropTarget ? 'insert-before' : ''}`}
    >
      <div
        ref={ref}
        className={`program-block block-${node.type} ${props.selected === node.id ? 'selected' : ''} ${active ? 'executing' : ''} ${contextual ? 'context-active' : ''} ${isDragging ? 'dragging' : ''}`}
        data-testid="program-block"
        data-block-id={node.id}
      >
        <div className="block-top">
          <span className="order-number">{number}</span>
          <button
            ref={handleRef}
            className="block-handle"
            disabled={props.locked}
            onClick={() => props.onSelect(node.id)}
            aria-label={`选择第${number}块${blockLabels[node.type]}${node.type === 'call' ? node.function : ''}`}
            aria-pressed={props.selected === node.id}
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                props.onDelete(node.id);
              }
              if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                props.onReorder(node.id, e.key === 'ArrowLeft' ? -1 : 1);
              }
            }}
          >
            <BlockIcon type={node.type} name={node.type === 'call' ? node.function : undefined} />
            <span>
              {blockLabels[node.type]}
              {node.type === 'call' && ` ${node.function}`}
            </span>
            <GripVertical className="grip" size={15} />
          </button>
          {('steps' in node || node.type === 'repeat') && (
            <label className="number-badge">
              <span className="sr-only">
                第{number}块{node.type === 'repeat' ? '重复次数' : '步数'}
              </span>
              <select
                aria-label={`第${number}块${node.type === 'repeat' ? '重复次数' : '步数'}`}
                disabled={props.locked}
                value={'steps' in node ? node.steps : node.times}
                onChange={(e) => props.onNumber(node.id, Number(e.target.value))}
              >
                {Array.from(
                  { length: node.type === 'repeat' ? 8 : 9 },
                  (_, i) => i + (node.type === 'repeat' ? 2 : 1),
                ).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {node.type === 'repeat' && (
          <>
            <div className="loop-description">
              <Repeat2 size={14} />
              {loop ? `第 ${loop.iteration} / ${loop.total} 轮` : `里面的指令做 ${node.times} 遍`}
              <button disabled={props.locked} onClick={() => props.onTarget(node.id)}>
                添加到里面 <ChevronRight size={14} />
              </button>
            </div>
            <ProgramList
              {...props}
              nodes={node.body}
              container={node.id}
              depth={props.depth + 1}
              prefix={number}
            />
          </>
        )}
        {active && props.focus && (
          <span className="step-bubble">
            {props.focus.total > 1
              ? `第 ${props.focus.step} / ${props.focus.total} 步`
              : '正在这里'}
          </span>
        )}
      </div>
    </div>
  );
}
function ProgramList(props: ListProps) {
  return (
    <div
      className={`program-list depth-${props.depth} ${props.targetContainer === props.container ? 'target-container' : ''}`}
    >
      {props.nodes.map((node, index) => (
        <BoardBlock {...props} key={node.id} node={node} index={index} />
      ))}
      <InsertEnd
        container={props.container}
        index={props.nodes.length}
        depth={props.depth}
        locked={props.locked}
        onTarget={() => props.onTarget(props.container)}
        empty={props.nodes.length === 0}
      />
    </div>
  );
}
export function Editor({
  level,
  history,
  onChange,
  onUndo,
  onRedo,
  onClear,
  locked,
  focus,
  onError,
}: {
  level: Level;
  history: EditorHistory;
  onChange: (program: Program) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  locked: boolean;
  focus: ExecutionFocus | null;
  onError: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [targetContainer, setTarget] = useState<ContainerId>('main');
  const program = history.present;
  const selectedNode = selected ? findBlock(program, selected) : undefined;
  const execute = (fn: () => Program) => {
    if (locked) return;
    try {
      onChange(fn());
    } catch (e) {
      onError(e instanceof Error ? e.message : '这块积木暂时放不到这里。');
    }
  };
  const target = (container: ContainerId) => {
    setTarget(container);
    setSelected(null);
  };
  const add = (type: Block['type'], name?: 'A' | 'B') =>
    execute(() => {
      const container =
        selectedNode?.container ??
        (getContainer(program, targetContainer) ? targetContainer : 'main');
      const block = newBlock(type, name);
      const next = insertBlock(
        program,
        block,
        container,
        selectedNode ? selectedNode.index + 1 : undefined,
      );
      setSelected(block.id);
      return next;
    });
  const remove = (id: string) =>
    execute(() => {
      setSelected(null);
      return removeBlock(program, id);
    });
  const reorder = (id: string, delta: number) =>
    execute(() => {
      const found = findBlock(program, id);
      if (!found) return program;
      const at = found.index + delta;
      if (at < 0 || at >= found.list.length) return program;
      return moveBlock(program, id, found.container, delta > 0 ? at + 1 : at);
    });
  const destinations: { id: string; label: string }[] = [{ id: 'main', label: '主程序' }];
  if (level.allowed.includes('call'))
    destinations.push({ id: 'A', label: '动作组合 A' }, { id: 'B', label: '动作组合 B' });
  const walk = (nodes: Block[], prefix: string) =>
    nodes.forEach((b, i) => {
      if (b.type === 'repeat') {
        destinations.push({ id: b.id, label: `${prefix} · 重复 ${i + 1}` });
        walk(b.body, `${prefix}.${i + 1}`);
      }
    });
  walk(program.main, '主程序');
  walk(program.functions.A, 'A');
  walk(program.functions.B, 'B');
  const effectiveContainer =
    selectedNode?.container ?? (getContainer(program, targetContainer) ? targetContainer : 'main');
  const targetLabel = destinations.find((d) => d.id === effectiveContainer)?.label ?? '主程序';
  const listProps = {
    selected: selectedNode ? selected : null,
    targetContainer: effectiveContainer,
    focus,
    locked,
    onSelect: setSelected,
    onTarget: target,
    onNumber: (id: string, value: number) => execute(() => changeNumber(program, id, value)),
    onDelete: remove,
    onReorder: reorder,
  };
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled || locked) return;
        const { source, target } = event.operation;
        if (!source || !target) return;
        const data = target.data as { container: ContainerId; index: number };
        if (typeof data.container !== 'string') return;
        execute(() =>
          source.data.kind === 'library'
            ? insertBlock(
                program,
                newBlock(source.data.type as Block['type'], source.data.name as 'A' | 'B'),
                data.container,
                data.index,
              )
            : moveBlock(program, String(source.id), data.container, data.index),
        );
      }}
    >
      <section className="toolbox">
        <div className="section-heading">
          <h2>
            <Puzzle size={19} /> 指令积木
          </h2>
          <span>点一点，或拖到编程板</span>
        </div>
        <div className="library-grid">
          {level.allowed.map((type) =>
            type === 'call' ? (
              (['A', 'B'] as const).map((name) => (
                <LibraryBlock
                  key={name}
                  type="call"
                  name={name}
                  disabled={locked}
                  onAdd={() => add('call', name)}
                />
              ))
            ) : (
              <LibraryBlock key={type} type={type} disabled={locked} onAdd={() => add(type)} />
            ),
          )}
        </div>
        {!level.allowed.includes('repeat') && (
          <div className="unlock-note">
            <LockKeyhole size={13} /> 转弯、重复和动作组合，将在后面的关卡陆续出现
          </div>
        )}
      </section>
      <section
        className="program-section"
        onKeyDown={(event) => {
          if (
            locked ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLInputElement
          )
            return;
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) onRedo();
            else onUndo();
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            onRedo();
          }
        }}
      >
        <div className="section-heading program-heading">
          <h2>
            我的编程板{' '}
            <span className="count-pill">
              {countBlocks(program)}
              {level.maxBlocks ? ` / ${level.maxBlocks}` : ''} 块
            </span>
          </h2>
          <div className="history-actions">
            <button
              className="icon-button"
              aria-label="撤销"
              title="撤销 Ctrl+Z"
              disabled={locked || !history.past.length}
              onClick={onUndo}
            >
              <Undo2 size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="重做"
              title="重做 Ctrl+Shift+Z"
              disabled={locked || !history.future.length}
              onClick={onRedo}
            >
              <Redo2 size={19} />
            </button>
            <span className="tool-separator" />
            <button
              className="icon-button"
              aria-label="清空程序"
              title="清空程序"
              disabled={locked || !countBlocks(program)}
              onClick={onClear}
            >
              <Trash2 size={19} />
            </button>
          </div>
        </div>
        <div className="board-paper">
          <div className="program-start">
            <span className="start-dot" /> 开始 <span>从左到右，按编号执行</span>
            {locked && (
              <b>
                <LockKeyhole size={13} /> 重置后可编辑
              </b>
            )}
          </div>
          <ProgramList {...listProps} nodes={program.main} container="main" depth={0} />
          <div className="program-end">
            <span /> 结束
          </div>
        </div>
        <div className="selection-toolbar">
          <span>
            {selectedNode
              ? `已选「${blockLabels[selectedNode.block.type]}」`
              : `将添加到：${targetLabel}`}
          </span>
          <div className="selection-actions">
            <button
              className="icon-button"
              title="向前移动 Alt+←"
              aria-label="向前移动积木"
              disabled={locked || !selectedNode || selectedNode.index === 0}
              onClick={() => selected && reorder(selected, -1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              title="向后移动 Alt+→"
              aria-label="向后移动积木"
              disabled={
                locked || !selectedNode || selectedNode.index === selectedNode.list.length - 1
              }
              onClick={() => selected && reorder(selected, 1)}
            >
              <ArrowRight size={17} />
            </button>
            <button
              className="icon-button"
              title="复制积木"
              aria-label="复制积木"
              disabled={locked || !selectedNode}
              onClick={() =>
                selectedNode &&
                execute(() =>
                  insertBlock(
                    program,
                    cloneBlock(selectedNode.block),
                    selectedNode.container,
                    selectedNode.index + 1,
                  ),
                )
              }
            >
              <Copy size={17} />
            </button>
            <button
              className="icon-button"
              title="删除积木 Delete"
              aria-label="删除积木"
              disabled={locked || !selectedNode}
              onClick={() => selected && remove(selected)}
            >
              <Trash2 size={17} />
            </button>
            {destinations.length > 1 && (
              <select
                className="move-select"
                aria-label="移动到程序区域"
                disabled={locked || !selectedNode}
                value=""
                onChange={(e) => {
                  const to = e.target.value;
                  selected && execute(() => moveBlock(program, selected, to));
                }}
              >
                <option value="" disabled>
                  移到…
                </option>
                {destinations
                  .filter((d) => d.id !== selectedNode?.container && d.id !== selected)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
        {level.allowed.includes('call') && (
          <div className="function-definitions">
            {(['A', 'B'] as const).map((name) => (
              <div
                key={name}
                className={`function-panel ${focus?.calls.some((c) => c.function === name) ? 'function-executing' : ''}`}
              >
                <div className="function-heading">
                  <h3>
                    <span className="function-symbol">{name}</span> 动作组合 {name}
                  </h3>
                  <span>被调用时才执行</span>
                </div>
                <ProgramList
                  {...listProps}
                  nodes={program.functions[name]}
                  container={name}
                  depth={0}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </DragDropProvider>
  );
}
