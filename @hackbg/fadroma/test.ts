#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testContext, testSuite, expect, forbid, matrix }  from "./tester.ts";
import { call, spawnContext, addArgs, exec, spawn } from './index.ts';
import { ok, equal } from './deps.ts';
import testZeroMQ from './network/zmq.test.ts';

const _ = undefined;

export default testSuite(import.meta, 'Fadroma',

  expect('Tester',
    expect('Context', call(testContext, _)),
    expect('Suite',   call(testSuite, null, 'Suite', _)),
    expect('Expect',  call(expect, 'Something'),
      expect('Chain', async () => {
        const context  = testContext();
        const returned = Symbol();
        const step     = expect('', () => { ok(true); return returned });
        const result   = await step(context);
        equal(result.returned, returned);
      })),
    expect('Forbid',  call(forbid, 'Something', () => {})),
    expect('Matrix',  call(matrix, 'Something', []))),

  expect('Process',
    expect('Context',
      call(spawnContext, _),
      ({ returned }) => equal(returned.pids, {})),
    expect('Args',
      () => equal({ ...spawn('true', 'foo', 'bar', 'baz') }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),
      () => equal({ ...exec('true', 'foo', 'bar', 'baz')  }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),),
    expect('Exec', async () => {
      const context = spawnContext();
      const run = exec('true');
      equal({ ...run }, { arg0: 'true', opts: [] });
      equal(await run(context), context);
    }),
    expect('Spawn', async () => {
      const context = spawnContext();
      const start = spawn('true');
      equal({ ...start }, { arg0: 'true', opts: [] });
      equal(await start(context), context);
      ok('pid' in start);
      ok(context.pids[start.pid].pid === start.pid);
      ok(context.pids[start.pid].killed === false);
      ok(context.pids[start.pid].kill());
      ok(context.pids[start.pid].killed === true);
    })),

  expect('Container', 'Pull', 'Run', 'Kill', 'Build'),

  expect('Network', 'TCP', 'HTTP', testZeroMQ),

  expect('Generator',
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
      expect('mold')))

);
