#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the, has }  from "./tester.ts";
import { spawnContext, exec, spawn } from '../index.ts';
import { ok, equal } from '../deps.ts';
export default suite(import.meta, 'Process',

  the('Context', spawnContext, has('pids')),

  the('Args',
    () => equal({ ...spawn('true', 'foo', 'bar', 'baz') }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),
    () => equal({ ...exec('true', 'foo', 'bar', 'baz')  }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),),

  the('Exec', async () => {
    const run = exec('true');
    equal({ ...run }, { arg0: 'true', opts: [] });
    const context = spawnContext();
    equal(await run(context), context);
  }),

  the('Spawn', async () => {
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
