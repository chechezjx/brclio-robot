import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudCheck,
  Download,
  Flag,
  FlaskConical,
  Footprints,
  Lightbulb,
  Map,
  Pause,
  Play,
  Puzzle,
  RotateCcw,
  Settings2,
  SkipForward,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { EditorHistory, Program, RunState, SavedData, Settings } from './types';
import { levels, freeLevel, getLevel } from './data/levels';
import { initialState } from './engine/interpreter';
import { Player } from './engine/player';
import { countBlocks } from './engine/validation';
import { Editor } from './features/editor/Editor';
import {
  editHistory,
  emptyProgram,
  historyFor,
  redoHistory,
  undoHistory,
} from './features/editor/model';
import { MapBoard } from './features/simulator/Map';
import { downloadProgram, freshData, importProgram, readLocal, writeLocal } from './storage/local';
import { RobotGlyph } from './components/Robot';
import { Modal } from './components/Modal';
import { playTone, unlockSound } from './components/sound';

function restore() {
  try {
    return readLocal(window.localStorage);
  } catch {
    return { data: freshData(), warning: '浏览器暂时不允许本地保存，请通过导出备份程序。' };
  }
}
export default function App() {
  const [loaded] = useState(restore);
  const [saved, setSaved] = useState<SavedData>(loaded.data);
  const level = getLevel(saved.currentLevel);
  const [history, setHistory] = useState<EditorHistory>(() =>
    historyFor(saved.drafts[level.id] ?? emptyProgram(level.id)),
  );
  const [run, setRun] = useState<RunState>(() => initialState(level));
  const [notice, setNotice] = useState(loaded.warning ?? '');
  const [saveError, setSaveError] = useState(false);
  const [modal, setModal] = useState<'levels' | 'help' | 'clear' | null>(null);
  const [hint, setHint] = useState(0);
  const [mobileTab, setMobileTab] = useState<'map' | 'code'>('map');
  const player = useRef<Player | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const latestLevel = useRef(level.id);
  latestLevel.current = level.id;
  const lifecycleVersion = useRef(0);
  const settings = saved.settings;
  const program = history.present;
  const locked = run.status === 'running' || run.status === 'paused';
  const completeCount = levels.filter((l) => saved.completed[l.id]).length;
  const [systemReduce, setSystemReduce] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setSystemReduce(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  useEffect(() => {
    const controller = new Player(getLevel(level.id), setRun);
    player.current = controller;
    controller.setSpeed(settings.speed);
    controller.reset();
    return () => {
      controller.dispose();
      if (player.current === controller) player.current = null;
    };
    // A level change owns and cancels the complete player lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);
  useEffect(() => {
    player.current?.setSpeed(settings.speed);
  }, [settings.speed]);
  useEffect(() => {
    let warning: string | undefined;
    try {
      warning = writeLocal(window.localStorage, saved);
    } catch {
      warning = '本次更改未能保存，请导出备份。';
    }
    setSaveError(Boolean(warning));
    if (warning) setNotice(warning);
  }, [saved]);
  useEffect(() => {
    if (run.status === 'success') {
      setSaved((previous) => ({
        ...previous,
        completed: {
          ...previous.completed,
          [level.id]: {
            levelId: level.id,
            blocks: countBlocks(program),
            completedAt: new Date().toISOString(),
          },
        },
      }));
    }
    if (settings.sound && run.actions > 0) playTone(run.status === 'success');
    // Completion records use the program locked for this execution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.actions, run.status]);
  const change = (next: Program) => {
    if (player.current?.locked) return;
    lifecycleVersion.current++;
    setHistory((previous) => editHistory(previous, next));
    setSaved((previous) => ({ ...previous, drafts: { ...previous.drafts, [level.id]: next } }));
    if (player.current?.state.status !== 'idle') player.current?.reset();
  };
  const travelHistory = (direction: 'undo' | 'redo') => {
    if (locked) return;
    lifecycleVersion.current++;
    const next = direction === 'undo' ? undoHistory(history) : redoHistory(history);
    setHistory(next);
    setSaved((previous) => ({
      ...previous,
      drafts: { ...previous.drafts, [level.id]: next.present },
    }));
    player.current?.reset();
  };
  const switchLevel = (id: string) => {
    lifecycleVersion.current++;
    const next = getLevel(id);
    player.current?.reset(next);
    setSaved((previous) => ({ ...previous, currentLevel: next.id }));
    setHistory(historyFor(saved.drafts[next.id] ?? emptyProgram(next.id)));
    setHint(0);
    setModal(null);
    setNotice('');
  };
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSaved((previous) => ({ ...previous, settings: { ...previous.settings, [key]: value } }));
  const start = () => {
    lifecycleVersion.current++;
    if (settings.sound) unlockSound();
    player.current?.run(program);
  };
  const singleStep = () => {
    lifecycleVersion.current++;
    if (settings.sound) unlockSound();
    player.current?.step(program);
  };
  const reset = () => {
    lifecycleVersion.current++;
    player.current?.reset();
  };
  const onImport = async (file?: File) => {
    if (!file || locked) return;
    const expectedLevel = level.id;
    const expectedVersion = ++lifecycleVersion.current;
    try {
      if (file.size > 256_000) throw new Error('文件太大了，请选择小于 256 KB 的程序。');
      const text = await file.text();
      const imported = importProgram(text, expectedLevel);
      if (
        lifecycleVersion.current !== expectedVersion ||
        latestLevel.current !== expectedLevel ||
        player.current?.locked
      )
        throw new Error('当前关卡或运行状态已改变，旧导入已取消。请重新导入。');
      change(imported);
      setNotice('程序已导入！可以运行，也可以撤销这次导入。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败，原来的程序没有改变。');
    } finally {
      if (upload.current) upload.current.value = '';
    }
  };
  return (
    <div className={`app-shell ${settings.reducedMotion || systemReduce ? 'reduce-motion' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#main" aria-label="Brclio Robot 编程机器人">
            <RobotGlyph />
            <span>
              Brclio <b>Robot</b>
              <small>编程机器人</small>
            </span>
          </a>
          <nav className="mode-nav" aria-label="学习模式">
            <button
              className={!level.freePlay ? 'active' : ''}
              onClick={() => (level.freePlay ? switchLevel('level-1') : setModal('levels'))}
            >
              <Map size={18} /> 闯关冒险
            </button>
            <button
              className={level.freePlay ? 'active' : ''}
              onClick={() => switchLevel(freeLevel.id)}
            >
              <FlaskConical size={18} /> 自由练习
            </button>
          </nav>
          <div className="header-actions">
            <span className="progress-stat">
              <Trophy size={17} /> <b>{completeCount}</b>
              <span>/ 12</span>
            </span>
            <span className="header-divider" />
            <button
              className="icon-button"
              title={settings.sound ? '关闭声音' : '开启声音'}
              aria-label={settings.sound ? '关闭声音' : '开启声音'}
              onClick={() => {
                if (!settings.sound) unlockSound();
                setting('sound', !settings.sound);
              }}
            >
              {settings.sound ? <Volume2 size={21} /> : <VolumeX size={21} />}
            </button>
            <button className="help-button" onClick={() => setModal('help')}>
              <CircleHelp size={20} />
              <span>帮助</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="workspace">
        <div className="journey-row">
          <span>
            <span className="small-dot" />{' '}
            {level.freePlay ? '尽情试一试你的新点子' : '每一个小指令，都是一次大冒险'}
          </span>
          <div className="save-status" role="status">
            <CloudCheck size={16} />
            {saveError ? '本地保存失败' : '已保存到此浏览器'}
          </div>
        </div>
        <div className="mission-heading">
          <div>
            <div className="eyebrow">
              {level.freePlay ? '自由探索' : `第 ${String(level.number).padStart(2, '0')} 关`}
              <span> / </span>
              {level.chapter}
            </div>
            <h1>
              {level.title}
              <span className="concept-pill">{level.concept}</span>
            </h1>
          </div>
          <button className="level-select" onClick={() => setModal('levels')}>
            <Map size={18} /> 选择关卡 <ChevronDown size={17} />
          </button>
        </div>
        {!level.freePlay && (
          <div className="level-track" aria-label="关卡进度">
            {levels.map((l) => (
              <button
                key={l.id}
                className={`${l.id === level.id ? 'current' : ''} ${saved.completed[l.id] ? 'done' : ''}`}
                onClick={() => switchLevel(l.id)}
                aria-label={`第${l.number}关 ${l.title}`}
                aria-current={level.id === l.id ? 'step' : undefined}
              >
                <span>
                  {saved.completed[l.id] ? <Check size={15} /> : String(l.number).padStart(2, '0')}
                </span>
                {l.id === level.id && <b>{l.title}</b>}
              </button>
            ))}
          </div>
        )}
        <div className="mobile-tabs" role="tablist" aria-label="工作台视图">
          <button
            role="tab"
            aria-selected={mobileTab === 'map'}
            onClick={() => setMobileTab('map')}
          >
            <Map size={18} /> 机器人地图
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === 'code'}
            onClick={() => setMobileTab('code')}
          >
            <Puzzle size={18} /> 我的编程板 <span>{countBlocks(program)}</span>
          </button>
        </div>
        <div className={`studio mobile-${mobileTab}`}>
          <section className="map-column panel">
            <div className="panel-heading">
              <h2>
                <span className="blue-dot" /> 机器人地图
              </h2>
              <span className="stars-count">
                <Star size={18} fill="#ffcd56" color="#dca429" />
                <b>{run.collected.length}</b> / {level.stars.length}
              </span>
            </div>
            <MapBoard
              level={level}
              state={run}
              trail={settings.trail}
              reducedMotion={settings.reducedMotion || systemReduce}
              speed={settings.speed}
            />
            <div className="mission-card">
              <div className="mission-icon">
                <Flag size={22} />
              </div>
              <div>
                <h3>这次的小任务</h3>
                <p>{level.story}</p>
                <div className="mission-rule">
                  {level.freePlay
                    ? '自由练习没有强制通关目标，尽情探索。'
                    : '程序结束时停在旗子上，并收集所有星星。'}
                </div>
              </div>
            </div>
            <div className="hint-area">
              <button
                className="hint-button"
                onClick={() => setHint((n) => Math.min(n + 1, level.hints.length))}
                disabled={hint === level.hints.length}
              >
                <Lightbulb size={18} />
                {hint === 0
                  ? '给我一点提示'
                  : hint < level.hints.length
                    ? '再给我一点提示'
                    : '提示都在这里啦'}
                <ChevronRight size={16} />
              </button>
              <span>
                {hint > 0 ? `${hint} / ${level.hints.length}` : '自己试试，也可以找点灵感'}
              </span>
            </div>
            {hint > 0 && (
              <div className="hints" aria-live="polite">
                {level.hints.slice(0, hint).map((text, i) => (
                  <p key={text}>
                    <b>{i + 1}</b>
                    {text}
                  </p>
                ))}
              </div>
            )}
          </section>
          <section className="editor-column panel" aria-label="编程工作台">
            <Editor
              key={level.id}
              level={level}
              history={history}
              onChange={change}
              onUndo={() => travelHistory('undo')}
              onRedo={() => travelHistory('redo')}
              onClear={() => setModal('clear')}
              locked={locked}
              focus={run.focus}
              onError={setNotice}
            />
            <div className="player-panel">
              <div className="player-options">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={settings.trail}
                    onChange={(e) => setting('trail', e.target.checked)}
                  />
                  <Footprints size={15} /> 显示轨迹
                </label>
                <div className="speed-control">
                  <span>速度</span>
                  {([0.5, 1, 2] as const).map((speed) => (
                    <button
                      key={speed}
                      aria-label={`${speed}倍速度`}
                      aria-pressed={settings.speed === speed}
                      className={settings.speed === speed ? 'active' : ''}
                      onClick={() => setting('speed', speed)}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="playback-controls">
                {run.status === 'running' ? (
                  <button
                    className="run-button pause-button"
                    onClick={() => player.current?.pause()}
                  >
                    <Pause size={22} fill="currentColor" /> 暂停
                  </button>
                ) : run.status === 'paused' ? (
                  <button className="run-button" onClick={() => player.current?.resume()}>
                    <Play size={22} fill="currentColor" /> 继续
                  </button>
                ) : (
                  <button className="run-button" onClick={start}>
                    <Play size={22} fill="currentColor" /> 运行程序
                  </button>
                )}
                <button
                  className="secondary-control"
                  disabled={run.status === 'running'}
                  onClick={singleStep}
                >
                  <SkipForward size={20} /> 单步
                </button>
                <button className="secondary-control" onClick={reset}>
                  <RotateCcw size={19} /> 重置
                </button>
              </div>
              <div
                className={`execution-feedback feedback-${run.status}`}
                role="status"
                data-testid="execution-status"
                data-status={run.status}
              >
                {run.status === 'success' ? (
                  <Trophy size={21} />
                ) : run.status === 'error' || run.status === 'incomplete' ? (
                  <Lightbulb size={21} />
                ) : run.status === 'running' ? (
                  <span className="running-dot" />
                ) : (
                  <RobotGlyph />
                )}
                <div>
                  <strong>
                    {run.status === 'running'
                      ? 'Brclio 正在执行你的指令…'
                      : run.status === 'paused'
                        ? '已暂停 · 可以单步观察，或继续'
                        : run.message}
                  </strong>
                  {run.focus && locked && (
                    <span>
                      {run.focus.calls.map((c) => `执行 ${c.function}`).join(' → ')}
                      {run.focus.loops.map((l) => ` · 第 ${l.iteration}/${l.total} 轮`).join('')}
                      {run.focus.total > 1 ? ` · 第 ${run.focus.step}/${run.focus.total} 步` : ''}
                    </span>
                  )}
                  {run.status === 'success' && (
                    <span>
                      你学会了「{level.concept}」，实际使用 {countBlocks(program)} 块积木。
                    </span>
                  )}
                </div>
              </div>
              {run.status === 'success' && !level.freePlay && (
                <button
                  className="next-level-button"
                  onClick={() => switchLevel(level.number < 12 ? levels[level.number].id : 'free')}
                >
                  {level.number < 12 ? '去下一关探险' : '进入自由实验室'}
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </section>
        </div>
        <footer className="workspace-footer">
          <span>
            <BookOpen size={16} /> 观察 → 规划 → 编程 → 试一试 → 再改进
          </span>
          <div>
            <input
              ref={upload}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="导入程序文件"
              onChange={(e) => void onImport(e.target.files?.[0])}
            />
            <button onClick={() => upload.current?.click()} disabled={locked}>
              <Upload size={16} /> 导入程序
            </button>
            <button onClick={() => downloadProgram(program)}>
              <Download size={16} /> 导出程序
            </button>
          </div>
        </footer>
      </main>
      {notice && (
        <div className="notice" role="alert">
          <CircleHelp size={21} />
          <span>{notice}</span>
          <button className="icon-button" onClick={() => setNotice('')} aria-label="关闭提示">
            <X size={19} />
          </button>
        </div>
      )}
      {modal === 'levels' && (
        <Modal title="下一站，去哪里探险？" onClose={() => setModal(null)} wide>
          <div className="level-modal-intro">
            <Sparkles size={18} />
            <span>按自己的节奏探索，已完成 {completeCount} / 12 关</span>
          </div>
          {['初次见面', '转弯的秘密', '重复的魔法', '我的动作组合'].map((chapter, i) => (
            <div className="chapter" key={chapter}>
              <h3>
                <span>0{i + 1}</span>
                {chapter}
              </h3>
              <div className="level-cards">
                {levels
                  .filter((l) => l.chapter === chapter)
                  .map((l) => (
                    <button
                      key={l.id}
                      onClick={() => switchLevel(l.id)}
                      className={`level-card ${l.id === level.id ? 'selected' : ''}`}
                    >
                      <span className="level-card-number">
                        {saved.completed[l.id] ? (
                          <CheckCheck size={22} />
                        ) : (
                          String(l.number).padStart(2, '0')
                        )}
                      </span>
                      <strong>{l.title}</strong>
                      <span>{l.concept}</span>
                      {l.id === level.id && <b>正在探索</b>}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <button className="free-level-card" onClick={() => switchLevel('free')}>
            <FlaskConical size={24} />
            <span>
              <strong>自由实验室</strong>
              <small>所有指令都已准备好，试试你的奇思妙想</small>
            </span>
            <ArrowRight size={20} />
          </button>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Brclio 的小小使用指南" onClose={() => setModal(null)}>
          <div className="help-intro">
            <RobotGlyph />
            <p>
              你好，我是 Brclio！
              <br />
              把指令排好，我就跟着你的想法走。
            </p>
          </div>
          <ol className="help-steps">
            <li>
              <b>观察地图</b>
              <span>小箭头指向前方。坐标从左上角 (0, 0) 开始，x 向右、y 向下。</span>
            </li>
            <li>
              <b>摆放积木</b>
              <span>点击或拖入指令；选中积木后可复制、删除和移动。循环里面的积木会一起重复。</span>
            </li>
            <li>
              <b>试一试，再修改</b>
              <span>运行从起点出发。暂停后可继续或单步；重置会回到起点并解锁编辑。</span>
            </li>
          </ol>
          <div className="keyboard-help">
            <strong>键盘也可以编程</strong>
            <p>
              Tab 移动焦点，Enter 选择或添加。积木上按 Alt + ← / → 调序，Delete 删除。编程板内 Ctrl
              / ⌘ + Z 撤销，Shift + Ctrl / ⌘ + Z 重做。也可用选中后的按钮移动到循环、主程序或函数。
            </p>
          </div>
          <div className="settings-section">
            <h3>
              <Settings2 size={19} /> 按你喜欢的方式探索
            </h3>
            <label>
              <span>指令提示音</span>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => {
                  if (e.target.checked) unlockSound();
                  setting('sound', e.target.checked);
                }}
              />
            </label>
            <label>
              <span>减少动画</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => setting('reducedMotion', e.target.checked)}
              />
            </label>
            <p>也会自动遵循设备的减少动画设置。</p>
          </div>
          <div className="storage-note">
            <CloudCheck size={22} />
            <p>
              草稿、进度和设置保存在当前浏览器，不会自动跨设备同步。清除浏览器数据可能丢失进度，请通过「导出程序」备份。我们不收集姓名、手机号，也没有追踪脚本。
            </p>
          </div>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title="要清空这份程序吗？" onClose={() => setModal(null)}>
          <p className="confirm-copy">
            主程序和动作组合里的积木都会被清空。清空后也可以用「撤销」找回来。
          </p>
          <div className="confirm-actions">
            <button className="secondary-control" onClick={() => setModal(null)}>
              <ArrowLeft size={18} /> 再想想
            </button>
            <button
              className="danger-button"
              onClick={() => {
                change(emptyProgram(level.id));
                setModal(null);
              }}
            >
              <Trash size={18} /> 确认清空
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Trash({ size }: { size: number }) {
  return <Trash2 size={size} />;
}
