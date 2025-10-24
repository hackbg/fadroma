#!/usr/bin/env -S deno run --allow-env --allow-run
import { stdin, stdout } from 'node:process';
import testSuite from './test.ts';
import { entrypoint, gray, exec, when, fg255, bg255 } from './lib/@hackbg/fadroma/index.ts';
import { tuiContext, runInput, runOutput, draw, at } from './lib/@hackbg/fadroma/frontend/tui.ts';

export type State = {
  list:     string[],
  scroll:   number,
  columns:  boolean,
  filter:   string,
  suite:    () => Promise<unknown>,
  runTests: () => Promise<unknown>,
  checks:   string[],
  check:    (_?: unknown) => unknown,
  runCheck: () => Promise<unknown>,
} & TuiState;

export default entrypoint(import.meta, async function main (_args) {
  if (stdin.isTTY && !stdin.isRaw) stdin.setRawMode(true);
  try {
    await start();
  } finally {
    if (stdin.isTTY && stdin.isRaw) stdin.setRawMode(false);
  }
});

export const start = (
  state: Partial<State> = tuiContext(stdin, stdout, {
    list:     collectList(collectTree(testSuite.steps)),
    scroll:   0,
    columns:  true,
    filter:   '',
    suite:    testSuite,
    runTests: () => Test.run(state.suite),

    checks:   [],
    check:    exec('deno', 'check', 'lib/btc/index.ts'),
    runCheck: async () => {
      const result = await state.check();
      console.log({result});
    },
  })
) => Promise.all([
  runInput(state as State, input),
  runOutput(state as State, output),
])

export const input = (state: State, chunk: string|Uint8Array) => {
  if (chunk.includes('q')) {
    state.exited = true;
  } else if (chunk.includes('t')) {
    state.runTests();
  } else if (chunk.includes('c')) {
    state.runCheck();
  } else if (chunk[0] === 0x09) {
    state.columns = !state.columns;
  } else if (chunk.length === 3 && chunk[0] === 0x1b && chunk[1] === 0x5b) {
    if (chunk[2] === 0x41) {
      state.scroll = Math.max(0, state.scroll - 1);
    }
    if (chunk[2] === 0x42) {
      state.scroll = Math.min(state.scroll + 1, state.list.length - state.height + 2);
    }
  } else {
    return false;
  }
  return true
};

const title = (state: State) =>
  at(0, 0, styled(' Fadroma'.padEnd(state.width)))(state);

const tests = when(
  (state: State) => !!state.columns,
  (state: State) => {
    const columns = collectColumns(state.height - 2, state.list.slice(state.scroll));
    for (let col = 0; col < columns.length; col++) {
      for (let row = 0; row < state.height - 2; row++) {
        const x = 1 + col * 45;
        state.cursorTo(x, row + 1);
        state.write((columns[col][row]||'').slice(0, state.width - x - 1));
      }
    }
  },
  (state: State) => {
    state.write(state.list.slice(state.scroll, state.scroll + state.height - 2).join('\n '));
  });

const status = (state: State) => {
  const size = `${state.width}x${state.height}`;
  return at(0, 0,
    at(Math.max(0, (state.width - size.length - 16) || 0), 0,
      styled('CPU '+((state.tD/state.tF)*100).toFixed(1)+'%')),
    at(Math.max(0, (state.width - size.length - 1) || 0), 0,
      styled(size), '\n '),
    at(0, state.height - 1, bg255(240)(' Filter: '), ' \x1b[1m'+state.filter)
  )(state)
};

const output = draw(title, tests, status);

const styled = (x: String) => '\x1b[1m'+fg255(16)(bg255(208)(x));

export const collectTree = (steps: Test.Step<unknown>[]) => {
  const output = []
  for (const step of steps) {
    if (step.name) output.push({
      name:  step.name,
      steps: step.steps ? collectTree(step.steps) : null
    });
  }
  return output
};

export const collectList = (steps: Test.Step<unknown>[], {
  maxWidth  = stdout.columns || 80,
  maxHeight = (stdout.rows - 2) || 25,
} = {}) => {
  let output = [];
  collectSteps([], steps);
  return output
  function collectSteps (ids, steps: Test.Step<unknown> = []) {
    for (const index in steps) {
      const step = steps[index];
      if (!step) continue;
      const subids = [...ids, Number(index)+1];
      output.push([
        (subids.join('.')+' ').padEnd(10,'┈')+' ',
        (subids.length < 2) && '\x1b[1m',
        gray(subids.length, step.name.padEnd(14))+' ',
        gray(10, 'ready')
      ].filter(Boolean).join(''));
      if (step.steps) collectSteps(subids, step.steps);
    }
  }
};

export const collectColumns = (height: number, list = []) =>
  Array((list.length % height)||0).fill('')
    .map((_, i)=>list.slice(i * height, (i + 1) * height));
