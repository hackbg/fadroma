import type { Timed } from '../index.ts';

export const tuiContext = (
  input: TuiIn, output: TuiOut, state = {}
): Tui => ({
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
}) as Tui;

export type Tui = FrameTimings & TuiIn & TuiOut & {
  exited:  boolean,
  input:   TuiIn,
  output:  TuiOut,
  width:   number,
  height:  number,
};

export type TuiIn = {
  [Symbol.asyncIterator] (): AsyncIterator<string|Uint8Array>
  isTTY: boolean,
  isRaw: boolean,
}

export type TuiOut = {
  rows,
  columns,
  cursorTo: (x: number, y: number) => void
  write:    (_: string)            => void
};

export type FrameTimings = Timed & {
  t1: number,
  tF: number,
  tS: number,
};

export const runInput = <T extends Tui> (
  state: T, handler: (state: T, chunk: string|Uint8Array)=>unknown
) => new Promise(async (resolve, reject)=>{
  try {
    while (!state.exited) {
      for await (const chunk of state.input) {
        if (await handler(state, chunk)) break;
      }
      if (state.exited) {
        break;
      }
    }
    resolve(true);
  } catch (e) {
    reject(e);
  }
})

export const runOutput = <T extends Tui> (
  state: T, ...steps: Array<string|((_: T)=>unknown)>
) => new Promise(async (resolve, reject)=>{
  try {
    console.clear();
    while (!state.exited) {
      state.t0 = performance.now();
      at(0, 0, ...steps)(state);
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

export const at = <T extends Tui> (
  x: number, y: number, ...steps: Array<string|((_: T)=>unknown)>
) => Object.assign(function drawAt (state: Tui) {
  state.cursorTo(x, y);
  return draw(...steps)(state);
});

export const draw = <T extends Tui> (
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
