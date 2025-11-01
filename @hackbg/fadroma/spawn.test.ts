#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite, expect }  from "./tester.ts";
import { call, spawnContext, exec, spawn } from './index.ts';
import { ok, equal } from './deps.ts';
const _ = undefined;
export default testSuite(import.meta, 'Process',
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
  }));
