#!/usr/bin/env -S deno run --allow-env --allow-run
import { stdin, stdout } from 'node:process';
import testSuite from './test.ts';
import * as Test from './lib/tester/index.ts';
import { entrypoint, gray } from './lib/core/index.ts';
import { run } from './lib/tester/index.ts';
import { exec } from './lib/spawn/index.ts';

const RESET = `\x1b[0m`;
const FG255 = x => `\x1b[38;5;${x}m`;
const BG255 = x => `\x1b[48;5;${x}m`;
const fg255 = (x) => (text) => `\x1b[38;5;${x}m${text}${RESET}`;
const bg255 = (x) => (text) => `\x1b[48;5;${x}m${text}${RESET}`;

export default entrypoint(import.meta, async function main (..._args) {
  let width  = stdout.columns || 80;
  let height = stdout.rows    || 25;
  let exited = false;
  const state = {
    exited:   false,
    size:     { width, height },

    list:     collectList(collectTree(testSuite.steps)),
    filter:   '',
    suite:    testSuite,
    runTests: () => run(state.suite),

    checks:   [],
    check:    exec('deno', 'check', 'lib/btc/index.ts'),
    runCheck: async () => {
      const result = await state.check();
      console.log({result});
    },
  };
  if (stdin.isTTY && !stdin.isRaw) stdin.setRawMode(true);
  try {
    await Promise.all([input(state), output(state)]);
  } finally {
    if (stdin.isTTY && stdin.isRaw) stdin.setRawMode(false);
  }
});

export function output (state) {
  return new Promise(async (resolve, reject)=>{
    try {
      console.clear();
      while (!state.exited) {
        const t0 = performance.now();
        //console.log(tF, (tF-tD));
        stdout.cursorTo(0, 0);
        stdout.write('\x1b[1m'+fg255(16)(bg255(208)('            Fadroma'.padEnd(state.size.width)))); 
        stdout.write('\n ')
        stdout.write(state.list.slice(0, state.size.height - 2).join('\n '));
        stdout.cursorTo(0, state.size.height - 1);
        stdout.write(bg255(240)(' Filter: '));
        stdout.write(' \x1b[1m'+state.filter);
        const t1 = performance.now();
        const tF = (1000/25);
        const tD = (t1 - t0);
        await new Promise(resolve=>setTimeout(resolve, Math.max(0, tF - tD)));
      }
      console.log('Output exited');
      resolve(true);
    } catch (e) {
      reject(e);
    }
  })
}

export const collectTree = (steps: Test.Step<unknown>[]) => {
  const output = []
  for (const step of steps) {
    if (step.name) output.push({
      name:  step.name,
      steps: step.steps ? collectTree(step.steps) : null
    });
  }
  return output
}
export const collectList = (steps: Test.Step<unknown>[], {
  maxWidth  = stdout.columns || 80,
  maxHeight = (stdout.rows - 2) || 25,
} = {}) => {
  let output = [];
  displaySteps([], steps);
  return output
  function displaySteps (ids, steps: Test.Step<unknown> = []) {
    for (const index in steps) {
      const step = steps[index];
      if (!step) continue;
      const subids = [...ids, Number(index)+1];
      output.push([
        (subids.join('.')+' ').padEnd(10,'┈')+' ',
        (subids.length < 2) && '\x1b[1m',
        gray(subids.length, step.name.padEnd(20)),
        gray(10, 'ready')
      ].filter(Boolean).join(''));
      if (step.steps) displaySteps(subids, step.steps);
    }
  }
}

export function input (state) {
  return new Promise(async (resolve, reject)=>{
    try {
      while (!state.exited) {
        for await (const chunk of stdin) {
          if (chunk.includes('q')) {
            state.exited = true;
            break;
          }
          if (chunk.includes('t')) {
            state.runTests();
          }
          if (chunk.includes('c')) {
            state.runCheck();
          }
        }
        if (state.exited) {
          console.log('Input exited');
          resolve(true);
          break;
        }
      }
    } catch (e) {
      reject(e);
    }
  })
}
