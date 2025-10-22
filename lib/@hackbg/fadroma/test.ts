#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testContext, suite, expect, forbid, matrix }  from "./tester.ts";
import { spawnContext, exec, spawn } from './index.ts';
import { ok, equal } from './deps.ts';

export const testTester = expect('Tester',
  expect('Context', () => { testContext(); }),
  expect('Suite',   () => { suite(null, 'Suite'); }),
  expect('Expect',  () => { expect('Something') }),
  expect('Forbid',  () => { forbid('Something', () => {}) }),
  expect('Matrix',  () => { matrix('Something', [], () => {}); }));

export const testSpawn = expect('Process',
  expect('Exec', async () => {
    const context = spawnContext();
    equal(await exec('true')(context), context);
  }),
  expect('Spawn', async () => {
    const context = spawnContext();
    equal(await spawn('true')(context), context);
  }),
  expect('Kill'));

export const testContainer = expect('Container',
  'Pull', 'Run', 'Kill', 'Build');

export const testGen = expect(
  'Generator',
  expect('Directory',
    '.gitignore',
    'README',
    expect('ES',
      expect('node/npm/pnpm'),
      expect('tsc'),
      expect('deno'),
      expect('eslint')),
    expect('Rust',
      expect('cargo', 'workspace'),
      expect('bacon'),
      expect('mold'))));

export default suite(import.meta, 'Fadroma',
  testTester,
  testSpawn,
  testGen);

//import * as Core from './index.ts'
//import * as assert from 'node:assert'
//Deno.test('timed logger', async () => {
  //await Core.timed(() => Promise.resolve(), (...args)=>console.log({timed: args}))
//})
//Deno.test('pickRandom', () => {
  //const values = ['ka', 'ram', 'bol']
  //const picked = Core.pickRandom(new Set(values))
  //assert.ok(values.includes(picked))
//})
//Deno.test('base error type has 2nd arg', () => {
  //assert.equal((new Core.Error('message', { parameter: 'value' }) as any).parameter, 'value')
//})
