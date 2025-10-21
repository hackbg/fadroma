import type { TuiState } from './types.ts';

export type TuiState = {
  exited: boolean,
  width:  number,
  height: number,
  input: { [Symbol.asyncIterator] (): AsyncIterator<string|Uint8Array> },
  cursorTo (x: number, y: number): void
  write (_: string): void
} & FrameTimings;

export type FrameTimings = {
  t0: number,
  t1: number,
  tF: number,
  tD: number,
  tS: number,
}

export const tui = (input, output, state = {}) => ({
  exited: false,

  input,
  isTTY: input?.isTTY || false,
  isRaw: input?.isRaw || false,

  output,
  width:    output?.columns || 80,
  height:   output?.rows    || 25,
  cursorTo: (...args) => output?.cursorTo(...args),
  write:    (...args) => output?.write(...args),

  ...state
});

export const when = (condition, callback, alternative?) =>
  Object.assign(async function conditional (state) {
    if (typeof condition === 'function') condition = await condition(state);
    if (condition) return callback(state);
    if (alternative) return alternative(state);
  }, { condition, callback, alternative });

export const runInput = <T extends TuiState> (
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

export const RESET = `\x1b[0m`;
export const FG255 = (x: number) => `\x1b[38;5;${x}m`;
export const BG255 = (x: number) => `\x1b[48;5;${x}m`;
export const fg255 = (x: number) => (text: string) => `\x1b[38;5;${x}m${text}${RESET}`;
export const bg255 = (x: number) => (text: string) => `\x1b[48;5;${x}m${text}${RESET}`;

export const runOutput = <T extends TuiState> (
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

export const at = <T extends TuiState> (
  x: number, y: number, ...steps: Array<string|((_: T)=>unknown)>
) => Object.assign(function drawAt (state: TuiState) {
  state.cursorTo(x, y);
  return draw(...steps)(state);
});

export const draw = <T extends TuiState> (
  ...steps: Array<string|((_: T)=>unknown)>
) => Object.assign(async function draw (state: TuiState) {
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
