import type { Async, Timed } from '../../index.ts';

export function Tui <T extends Tui> (
  state:  T       = {} as T,
  input:  Tui.In  = Tui.In(state, () => true),
  output: Tui.Out = Tui.Out(state),
): Tui {
  return {
    exited: false,

    input,
    isTTY: input?.isTTY || false,
    isRaw: input?.isRaw || false,
    get [Symbol.asyncIterator] () { return input[Symbol.asyncIterator] },

    output,
    rows:     output?.columns || 80,
    columns:  output?.rows    || 25,
    width:    output?.columns || 80,
    height:   output?.rows    || 25,
    cursorTo: (...args) => output?.cursorTo(...args),
    write:    (...args) => output?.write(...args),

    ...state
  } as Tui;
}

Tui.In = function TuiIn <T extends Tui> (
  state: T =
    { exited: true } as T,
  handler: (state: T, chunk: string|Uint8Array)=>unknown =
    () => true,
): Promise<boolean> {
  return new Promise(async (resolve, reject)=>{
    try {
      while (!state.exited) {
        for await (const chunk of state.input) {
          state.exited ||= Boolean(await handler(state, chunk));
          if (state.exited) break;
        }
      }
      resolve(state.exited);
    } catch (e) {
      reject(e);
    }
  })
}

Tui.Out = function TuiOut <T extends Tui> (
  state: T = { exited: true } as T,
  ...steps: Array<string|((_: T)=>unknown)>
): Promise<boolean> {
  return new Promise(async (resolve, reject)=>{
    try {
      console.clear();
      while (!state.exited) {
        state.t0 = performance.now();
        Tui.at(0, 0, ...steps)(state);
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
  });
}

Tui.at = <T extends Tui> (
  x: number, y: number, ...steps: Array<string|((_: T)=>unknown)>
) => Object.assign(function drawAt (state: Tui) {
  state.cursorTo(x, y);
  return Tui.draw(...steps)(state);
});

Tui.draw = <T extends Tui> (
  ...steps: Array<string|((_: T)=>unknown)>
) => Object.assign(async function draw (state: T) {
  for (const step of steps) {
    if (typeof step === 'string') {
      state.write(step);
    } else if (typeof step === 'function') {
      await step(state);
    } else if (step) {
      throw new Error('unsupported step');
    }
  }
  return state
});

/** Terminal user interface. */
export type Tui = Tui.Timings & Tui.In & Tui.Out & Tui.State;

/** Terminal user interface internals. */
export namespace Tui {
  export interface In {
    [Symbol.asyncIterator] (): AsyncIterator<string|Uint8Array>
    isTTY: boolean,
    isRaw: boolean,
  }
  export interface Out {
    rows:     number,
    columns:  number,
    cursorTo: (x: number, y: number) => void
    write:    (_: string)            => void
  };
  export interface State {
    exited:  boolean,
    input:   Tui.In,
    output:  Tui.Out,
    width:   number,
    height:  number,
  };
  export type Timings = Timed & {
    t1: number,
    tF: number,
    tS: number,
  };
}
