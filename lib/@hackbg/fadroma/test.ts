#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testContext, suite, expect, forbid, matrix }  from "./tester.ts";
import { spawnContext, addArgs, exec, spawn } from './index.ts';
import { ok, equal } from './deps.ts';
import testZeroMQ from './network/zmq.test.ts';

export const testTester = expect('Tester',
  expect('Context', () => { testContext(); }),
  expect('Suite',   () => { suite(null, 'Suite'); }),
  expect('Expect',  () => { expect('Something') }),
  expect('Forbid',  () => { forbid('Something', () => {}) }),
  expect('Matrix',  () => { matrix('Something', [], () => {}); }));

export const testSpawn = expect('Process',
  expect('Context', () => {
    const context = spawnContext();
    equal(context.pids, {});
  }),
  expect('Args', () => {
    const args = addArgs('foo', 'bar', 'baz');
    equal({ ...spawn('true', args) }, { arg0: 'true', options: [args] });
    equal({ ...exec('true', args)  }, { arg0: 'true', options: [args] });
  }),
  expect('Exec', async () => {
    const context = spawnContext();
    const run = exec('true');
    equal({ ...run }, { arg0: 'true', options: [] });
    equal(await run(context), context);
  }),
  expect('Spawn and kill', async () => {
    const context = spawnContext();
    const start = spawn('true');
    equal({ ...start }, { arg0: 'true', options: [] });
    equal(await start(context), context);
    ok('pid' in start);
    ok(context.pids[start.pid].pid === start.pid);
    ok(context.pids[start.pid].killed === false);
    ok(context.pids[start.pid].kill());
    ok(context.pids[start.pid].killed === true);
  }));

export const testContainer = expect('Container',
  'Pull', 'Run', 'Kill', 'Build');

export const testGen = expect('Generator',
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
    expect('mold')));

export const testNet = expect('Network',
  expect('TCP'),
  expect('HTTP'),
  testZeroMQ);

export default suite(import.meta, 'Fadroma',
  testTester, testSpawn, testNet, testGen);

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
