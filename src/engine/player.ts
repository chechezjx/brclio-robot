import type { Level, Program, RunState, Settings } from '../types';
import { initialState, Interpreter } from './interpreter';

/** Owns one timer. A generation token invalidates queued callbacks on every cancellation. */
export class Player {
  private machine?: Interpreter;
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private disposed = false;
  private automatic = false;
  private _state: RunState;
  private speed: Settings['speed'] = 1;
  constructor(
    private level: Level,
    private onChange: (state: RunState) => void,
  ) {
    this._state = initialState(level);
  }
  get state() {
    return this._state;
  }
  get locked() {
    return this._state.status === 'running' || this._state.status === 'paused';
  }
  setSpeed(speed: Settings['speed']) {
    this.speed = speed;
  }
  private publish() {
    if (this.disposed) return;
    const state = this.machine?.state ?? initialState(this.level);
    this._state = {
      ...state,
      status: this.automatic && state.status === 'paused' ? 'running' : state.status,
    };
    this.onChange(this._state);
  }
  private cancel() {
    this.epoch++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.automatic = false;
  }
  private schedule() {
    const generation = this.epoch;
    this.timer = setTimeout(() => {
      if (this.disposed || generation !== this.epoch || !this.automatic || !this.machine) return;
      this.machine.step();
      if (this.machine.state.status !== 'paused') this.automatic = false;
      this.publish();
      if (this.automatic) this.schedule();
    }, 600 / this.speed);
  }
  run(program: Program) {
    if (this.disposed || this.locked) return;
    this.cancel();
    this.machine = new Interpreter(this.level, program);
    this.automatic = this.machine.state.status === 'paused';
    this.publish();
    if (this.automatic) this.schedule();
  }
  pause() {
    if (!this.automatic) return;
    // Atoms are synchronous; the current atom is already complete. No next atom can start.
    this.cancel();
    this.publish();
  }
  resume() {
    if (this.disposed || this._state.status !== 'paused') return;
    this.automatic = true;
    this.publish();
    this.schedule();
  }
  step(program: Program) {
    if (this.disposed || this.automatic) return;
    if (!this.locked) {
      this.cancel();
      this.machine = new Interpreter(this.level, program);
    }
    this.machine?.step();
    this.publish();
  }
  reset(level = this.level) {
    this.cancel();
    this.level = level;
    this.machine = undefined;
    this.publish();
  }
  dispose() {
    this.cancel();
    this.disposed = true;
    this.machine = undefined;
  }
}
