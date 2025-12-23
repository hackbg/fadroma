import type { Timed } from '../index.ts';
import { stdin, stdout } from '../deps.ts';
/** Launch a terminal user interface. */
export function Tui <T extends Tui> (state: T = {} as T): T {
  state.exited ??= false;
  state.input  ??= Tui.In(state.input || stdin, state, () => true);
  state.output ??= Tui.Out(state.output || stdout, state);
  return state;
}
/** Terminal user interface. */
export type Tui = Tui.Timings & Tui.In & Tui.Out & Tui.State;
/** Terminal user interface internals. */
export namespace Tui {
  /** Runtime state of terminal user interface. */
  export type State = {
    exited:  boolean,
    input:   Tui.In,
    output:  Tui.Out,
    width:   number,
    height:  number,
  };
  /** Input loop of terminal user interface. */
  export type In = Promise<boolean> & {
    [Symbol.asyncIterator] (): AsyncIterator<string|Uint8Array>
    isTTY: boolean,
    isRaw: boolean,
  }
  /** Output loop of terminal user interface. */
  export type Out = Promise<boolean> & {
    rows:     number,
    columns:  number,
    cursorTo: typeof stdout["cursorTo"],
    write:    typeof stdout["write"]
  };
  /** Time it took to render a terminal frame. */
  export type Timings = Timed & {
    t1: number,
    tF: number,
    tS: number,
  };
}

Tui.In = function TuiIn <T extends Tui> (
  input: Partial<Tui.In> = stdin,
  state: T = { exited: false } as T,
  handler: (state: T, chunk: string|Uint8Array)=>unknown =
    () => true,
) {
  return Object.assign(new Promise(async (resolve, reject)=>{
    try {
      while (!state.exited) {
        if (state.input) for await (const chunk of state.input) {
          state.exited ||= Boolean(await handler(state, chunk));
          if (state.exited) break;
        } else {
          break;
        }
      }
      resolve(state.exited);
    } catch (e) {
      reject(e);
    }
  }), {
    isTTY: input?.isTTY || false,
    isRaw: input?.isRaw || false,
    get [Symbol.asyncIterator] () { return input[Symbol.asyncIterator] },
  }) as Tui.In;
}

Tui.Out = function TuiOut <T extends Tui> (
  output: Partial<Tui.Out> = stdout,
  state: T = { exited: false } as T,
  ...steps: Array<string|((_: T)=>unknown)>
) {
  return Object.assign(new Promise(async (resolve, reject)=>{
    try {
      console.clear();
      while (!state.exited) {
        state.t0 = performance.now();
        output.cursorTo(0, 0);
        for (const step of steps) {
          if (typeof step === 'string') {
            state.write(step);
          } else if (typeof step === 'function') {
            await step(state);
          } else if (step) {
            throw new Error('unsupported step');
          }
        }
        state.t1 = performance.now();
        state.tF = (1000/25);
        state.tD = state.t1 - state.t0;
        state.tS = state.tF - state.tD;
        const wait = Math.max(0, state.tS);
        await new Promise(resolve=>setTimeout(resolve, wait));
      }
      resolve(true);
    } catch (e) {
      reject(e);
    }
  }), {
    rows:     output?.columns || 80,
    columns:  output?.rows    || 25,
    width:    output?.columns || 80,
    height:   output?.rows    || 25,
    cursorTo: (x, y) => output?.cursorTo(x, y),
    write:    (x) => output?.write(x),
  }) as Tui.Out;
}
