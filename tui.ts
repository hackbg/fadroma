#!/usr/bin/env -S deno run --allow-env
import { entrypoint, gray } from '@fadroma/core';
import { run } from '@fadroma/tester';
import { stdin, stdout } from 'node:process';
import testSuite from './test.ts';

const RESET = `\x1b[0m`;
const FG255 = x => `\x1b[38;5;${x}m`;
const BG255 = x => `\x1b[48;5;${x}m`;
const fg255 = (x) => (text) => `\x1b[38;5;${x}m${text}${RESET}`;
const bg255 = (x) => (text) => `\x1b[48;5;${x}m${text}${RESET}`;

export default entrypoint(import.meta, async function main ({
  width  = stdout.columns || 80,
  height = stdout.rows    || 25,
  prompt = '',
} = {}) {
  let exited = false;
  const state = {
    exited: false,
    size:   { width, height },
    list:   collectList(collectTree(testSuite.steps)),
    filter: '',
    run:    () => run(testSuite),
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
      while (!state.exited) {
        const t0 = performance.now();
        console.clear();
        const t1 = performance.now();
        const tF = (1000/25);
        const tD = (t1 - t0);
        //console.log(tF, (tF-tD));
        stdout.write('\x1b[1m'+fg255(16)(bg255(208)('            Fadroma'.padEnd(state.size.width)))); 
        stdout.write('\n ')
        stdout.write(state.list.slice(0, state.size.height - 2).join('\n '));
        stdout.cursorTo(0, state.size.height - 1);
        stdout.write(bg255(240)(' Filter: '));
        stdout.write(' \x1b[1m'+state.filter);
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
            state.run();
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
