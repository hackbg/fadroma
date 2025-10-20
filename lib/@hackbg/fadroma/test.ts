#!/usr/bin/env -S deno run --allow-env --allow-net --allow-run
import { suite, expect }  from "@hackbg/fadroma";

export const testTester = expect(
  'Tester',
  expect('Category'),
  expect('Context'),
  expect('Counter'),
  expect('Result'),
  expect('Suite'),
  expect('Expect'),
  expect('Forbid'),
  expect('Matrix'));

export const testSpawn = expect(
  'Spawn',
  expect('Process'),
  expect('Docker', 'Pull', 'Run', 'Kill', 'Build'));

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
